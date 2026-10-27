// CommitZero - Application State Provider
// Pure JavaScript React context with persistent localStorage synchronization and schedule consistency

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  STORAGE_KEYS,
  defaultPreferences,
  loadFromStorage,
  saveToStorage,
  clearAllStorage,
} from '../utils/storage.js';
import {
  createTask,
  TaskStatus,
  TaskPriority,
  validateTaskInput,
  getTaskRemainingMinutes,
} from '../models/taskModel.js';
import {
  createSessionRecord,
  SessionOutcome,
  calculateCurrentElapsedSeconds,
} from '../models/sessionModel.js';
import { generateDailySchedule } from '../engine/scheduler.js';
import {
  analyzePlanRecovery,
  RecoveryTriggerReason,
} from '../engine/recovery.js';
import { authApi, taskApi, sessionApi, userApi } from '../utils/api.js';
import {
  removeDemoTasks,
  removeDemoSessions,
  removeDemoPlan,
  removeDemoPreferences,
} from '../utils/guestData.js';

const AppContext = createContext(null);

function loadGuestTasks() {
  return removeDemoTasks(loadFromStorage(STORAGE_KEYS.TASKS, []));
}

function loadGuestSessions() {
  return removeDemoSessions(loadFromStorage(STORAGE_KEYS.SESSIONS, []));
}

function loadGuestPlan() {
  return removeDemoPlan(loadFromStorage(STORAGE_KEYS.DAILY_PLAN, null));
}

function loadGuestPreferences() {
  const preferences = loadFromStorage(STORAGE_KEYS.PREFERENCES, defaultPreferences);
  return removeDemoPreferences(preferences);
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const skipPreferenceSync = useRef(false);
  // Navigation
  const [currentView, setCurrentView] = useState('dashboard');

  // Tasks state
  const [tasks, setTasks] = useState(loadGuestTasks);

  // Focus sessions state
  const [sessions, setSessions] = useState(() => {
    return loadGuestSessions();
  });

  // Scheduling Preferences
  const [preferences, setPreferences] = useState(() => {
    return loadGuestPreferences();
  });

  // Current Daily Plan
  const [currentPlan, setCurrentPlan] = useState(() => {
    return loadGuestPlan();
  });

  // Schedule Staleness / Invalidation indicator
  const [planStaleInfo, setPlanStaleInfo] = useState(null);

  // Storage error tracking
  const [storageWarning, setStorageWarning] = useState(null);

  // Active Focus Timer state
  const [activeTimer, setActiveTimer] = useState(() => {
    const loaded = loadFromStorage(STORAGE_KEYS.ACTIVE_SESSION, null);
    if (!loaded) return null;
    return loaded;
  });

  // Live timer tick for UI update (active seconds)
  const [liveElapsedSeconds, setLiveElapsedSeconds] = useState(0);

  // Recovery proposal state (when active)
  const [recoveryProposal, setRecoveryProposal] = useState(null);

  // Global notification banner / toast
  const [notice, setNotice] = useState(null);

  const showNotice = useCallback((message, type = 'info', duration = 4000) => {
    setNotice({ message, type, id: Date.now() });
    if (duration > 0) {
      setTimeout(() => {
        setNotice((current) => (current?.message === message ? null : current));
      }, duration);
    }
  }, []);

  const loadAccountData = useCallback(async (account, { importLocal = false } = {}) => {
    setCloudReady(false);
    const localTasks = loadGuestTasks();
    const localSessions = loadGuestSessions();
    const localPreferences = loadGuestPreferences();
    const localPlan = loadGuestPlan();
    const [remoteTasksResult, remoteSessionsResult, remotePreferencesResult] = await Promise.all([
      taskApi.list(), sessionApi.list(), userApi.getPreferences(),
    ]);
    let remoteTasks = removeDemoTasks(remoteTasksResult.tasks || []);
    let remoteSessions = removeDemoSessions(remoteSessionsResult.sessions || []);
    if (importLocal && remoteTasks.length === 0 && localTasks.length > 0) {
      const migrated = await Promise.all(localTasks.map((task) => taskApi.create(task)));
      remoteTasks = migrated.map((item) => item.task);
    }
    if (importLocal && remoteSessions.length === 0 && localSessions.length > 0) {
      const migrated = await Promise.all(localSessions.map((session) => sessionApi.create(session)));
      remoteSessions = migrated.map((item) => item.session);
    }
    const remotePreferences = removeDemoPreferences(remotePreferencesResult.preferences || {});
    skipPreferenceSync.current = Boolean(
      remotePreferencesResult.preferences?.unavailablePeriods?.some((period) => period.id === 'office-hours'),
    );
    const resolvedPreferences = Object.keys(remotePreferences).length ? remotePreferences : localPreferences;
    if (!Object.keys(remotePreferences).length) await userApi.updatePreferences(resolvedPreferences);
    const planDate = resolvedPreferences.planDate || new Date().toISOString().slice(0, 10);
    const planResult = await userApi.getPlan(planDate);
    let resolvedPlan = removeDemoPlan(planResult.plan || null);
    if (importLocal && !resolvedPlan && localPlan) {
      resolvedPlan = localPlan;
      await userApi.savePlan(planDate, localPlan);
    }
    setTasks(remoteTasks);
    setSessions(remoteSessions);
    setPreferences(resolvedPreferences);
    setCurrentPlan(resolvedPlan);
    setActiveTimer(null);
    setRecoveryProposal(null);
    setPlanStaleInfo(null);
    setUser(account);
    setCloudReady(true);
    setCurrentView('dashboard');
    showNotice(`Signed in as ${account.name}. Your account data is ready.`, 'success');
  }, [showNotice]);

  const authenticate = useCallback(async ({ mode, name, email, password }) => {
    const result = mode === 'register'
      ? await authApi.register({ name, email, password })
      : await authApi.login({ email, password });
    await loadAccountData(result.user, { importLocal: mode === 'register' });
  }, [loadAccountData]);

  const signOut = useCallback(async () => {
    try { await authApi.logout(); } catch (error) { console.warn('Server sign-out could not be confirmed:', error.message); }
    setUser(null);
    setCloudReady(false);
    setPreferences(loadGuestPreferences());
    setTasks(loadGuestTasks());
    setSessions(loadGuestSessions());
    setCurrentPlan(loadGuestPlan());
    setActiveTimer(loadFromStorage(STORAGE_KEYS.ACTIVE_SESSION, null));
    setRecoveryProposal(null);
    setPlanStaleInfo(null);
    setCurrentView('dashboard');
    showNotice('Signed out. Guest data on this device is available.', 'info');
  }, [showNotice]);

  const continueAsGuest = useCallback(() => {
    setUser(null);
    setCloudReady(false);
    setCurrentView('dashboard');
  }, []);

  useEffect(() => {
    let active = true;
    authApi.me().then(({ user: account }) => loadAccountData(account)).catch((error) => {
      if (error.status !== 401) showNotice(`Could not load your account. Continuing with guest data: ${error.message}`, 'warning', 6000);
    }).finally(() => {
      if (active) setAuthReady(true);
    });
    return () => { active = false; };
  }, [loadAccountData, showNotice]);

  // Sync to localStorage with write failure detection
  useEffect(() => {
    if (user) return;
    const ok = saveToStorage(STORAGE_KEYS.TASKS, tasks);
    if (!ok) setStorageWarning('Unable to save tasks to local storage. Quota may be exceeded.');
  }, [tasks, user]);

  useEffect(() => {
    if (user) return;
    const ok = saveToStorage(STORAGE_KEYS.SESSIONS, sessions);
    if (!ok) setStorageWarning('Unable to save session history to local storage.');
  }, [sessions, user]);

  useEffect(() => {
    if (user) return;
    const ok = saveToStorage(STORAGE_KEYS.PREFERENCES, preferences);
    if (!ok) setStorageWarning('Unable to save preferences to local storage.');
  }, [preferences, user]);

  useEffect(() => {
    if (user) return;
    const ok = saveToStorage(STORAGE_KEYS.DAILY_PLAN, currentPlan);
    if (!ok) setStorageWarning('Unable to save daily plan to local storage.');
  }, [currentPlan, user]);

  useEffect(() => {
    if (user) return;
    saveToStorage(STORAGE_KEYS.ACTIVE_SESSION, activeTimer);
  }, [activeTimer, user]);

  useEffect(() => {
    if (!user || !cloudReady) return;
    if (skipPreferenceSync.current) {
      skipPreferenceSync.current = false;
      return;
    }
    userApi.updatePreferences(preferences).catch((error) => showNotice(`Could not sync preferences: ${error.message}`, 'warning'));
  }, [user, cloudReady, preferences, showNotice]);

  useEffect(() => {
    if (!user || !cloudReady || !currentPlan?.planDate) return;
    userApi.savePlan(currentPlan.planDate, currentPlan).catch((error) => showNotice(`Could not sync daily plan: ${error.message}`, 'warning'));
  }, [user, cloudReady, currentPlan, showNotice]);

  // Live timer ticker
  useEffect(() => {
    if (!activeTimer || !activeTimer.isRunning || activeTimer.isPaused) {
      if (activeTimer) {
        setLiveElapsedSeconds(activeTimer.accumulatedSeconds || 0);
      } else {
        setLiveElapsedSeconds(0);
      }
      return;
    }

    const interval = setInterval(() => {
      const current = calculateCurrentElapsedSeconds(activeTimer);
      setLiveElapsedSeconds(current);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimer]);

  // Auto-generate initial plan if none exists
  useEffect(() => {
    if (!user && !currentPlan && tasks.length > 0) {
      const plan = generateDailySchedule(tasks, preferences, preferences.planDate, new Date());
      setCurrentPlan(plan);
      setPlanStaleInfo(null);
    }
  }, [currentPlan, tasks, preferences, user]);

  // -------------------- TASK MANAGEMENT ACTIONS --------------------
  const addTask = useCallback((taskInput) => {
    const validation = validateTaskInput(taskInput);
    if (!validation.isValid) {
      return { success: false, errors: validation.errors };
    }

    const newTask = createTask(taskInput);
    setTasks((prev) => [newTask, ...prev]);
    if (user && cloudReady) taskApi.create(newTask).catch((error) => showNotice(`Task saved locally but cloud sync failed: ${error.message}`, 'warning', 6000));

    // Schedule Invalidation: Mark plan as needing recalculation
    setPlanStaleInfo({
      isStale: true,
      reason: `New task "${newTask.title}" was added. Recalculate schedule to incorporate it.`,
    });

    showNotice(`Created task "${newTask.title}"`, 'success');
    return { success: true, task: newTask };
  }, [showNotice, user, cloudReady]);

  const updateTask = useCallback((taskId, updates) => {
    let hasSchedulingChanges = false;
    let updatedTitle = null;
    let updatedSubject = null;

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const updated = { ...t, ...updates };

          if (updates.estimatedDurationMinutes !== undefined) {
            updated.estimatedDurationMinutes = Math.max(1, Math.round(Number(updates.estimatedDurationMinutes)));
            hasSchedulingChanges = true;
          }

          if (updates.remainingDurationMinutes !== undefined) {
            updated.remainingDurationMinutes = Math.max(0, Math.round(Number(updates.remainingDurationMinutes)));
            hasSchedulingChanges = true;
          }

          if (updates.priority !== undefined && updates.priority !== t.priority) {
            hasSchedulingChanges = true;
          }

          if (updates.deadline !== undefined && updates.deadline !== t.deadline) {
            hasSchedulingChanges = true;
          }

          if (updates.title && updates.title !== t.title) {
            updatedTitle = updates.title.trim();
          }

          if (updates.subject && updates.subject !== t.subject) {
            updatedSubject = updates.subject;
          }

          return updated;
        }
        return t;
      })
    );
    if (user && cloudReady) taskApi.update(taskId, updates).catch((error) => showNotice(`Task update could not sync to cloud: ${error.message}`, 'warning', 6000));

    // Sync titles/subjects in existing schedule blocks immediately without breaking timings
    if (updatedTitle || updatedSubject) {
      setCurrentPlan((prevPlan) => {
        if (!prevPlan || !prevPlan.blocks) return prevPlan;
        return {
          ...prevPlan,
          blocks: prevPlan.blocks.map((b) => {
            if (b.taskId === taskId) {
              return {
                ...b,
                taskTitle: updatedTitle || b.taskTitle,
                subject: updatedSubject || b.subject,
              };
            }
            return b;
          }),
        };
      });
    }

    // Schedule Invalidation: flag if duration, priority, or deadline changed
    if (hasSchedulingChanges) {
      setPlanStaleInfo({
        isStale: true,
        reason: 'Task scheduling parameters (duration, priority, or deadline) changed.',
      });
    }

    showNotice('Task updated successfully', 'success');
    return { success: true };
  }, [showNotice, user, cloudReady]);

  const deleteTask = useCallback((taskId) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (user && cloudReady) taskApi.remove(taskId).catch((error) => showNotice(`Task deletion could not sync to cloud: ${error.message}`, 'warning', 6000));

    // If active timer belongs to this task, cancel timer
    if (activeTimer?.taskId === taskId) {
      setActiveTimer(null);
      setLiveElapsedSeconds(0);
    }

    // Update daily plan to remove block and mark plan stale to close gaps
    setCurrentPlan((prev) => {
      if (!prev) return null;
      const filteredBlocks = prev.blocks.filter((b) => b.taskId !== taskId);
      const newAllocated = filteredBlocks
        .filter((b) => !b.isBreak)
        .reduce((sum, b) => sum + (b.durationMinutes || 0), 0);

      return {
        ...prev,
        blocks: filteredBlocks,
        stats: {
          ...prev.stats,
          totalAllocatedMinutes: newAllocated,
          scheduledTasksCount: new Set(filteredBlocks.filter((b) => !b.isBreak).map((b) => b.taskId)).size,
        },
      };
    });

    setPlanStaleInfo({
      isStale: true,
      reason: 'Task was deleted. Recalculate schedule to close open timeline gaps.',
    });

    showNotice('Task deleted. Session history preserved.', 'info');
  }, [activeTimer, showNotice, user, cloudReady]);

  const toggleTaskComplete = useCallback((taskId) => {
    let nowComplete = false;

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          nowComplete = t.status !== TaskStatus.COMPLETED;
          return {
            ...t,
            status: nowComplete ? TaskStatus.COMPLETED : TaskStatus.PENDING,
            remainingDurationMinutes: nowComplete ? 0 : t.estimatedDurationMinutes,
            completedAt: nowComplete ? new Date().toISOString() : null,
          };
        }
        return t;
      })
    );

    // Update schedule blocks status
    setCurrentPlan((prevPlan) => {
      if (!prevPlan || !prevPlan.blocks) return prevPlan;
      return {
        ...prevPlan,
        blocks: prevPlan.blocks.map((b) => {
          if (b.taskId === taskId) {
            return {
              ...b,
              status: nowComplete ? 'Completed' : 'Upcoming',
            };
          }
          return b;
        }),
      };
    });

    if (user && cloudReady) {
      const task = tasks.find((item) => item.id === taskId);
      if (task) taskApi.update(taskId, { status: nowComplete ? TaskStatus.COMPLETED : TaskStatus.PENDING, remainingDurationMinutes: nowComplete ? 0 : task.estimatedDurationMinutes, completedAt: nowComplete ? new Date().toISOString() : null }).catch((error) => showNotice(`Task status could not sync to cloud: ${error.message}`, 'warning', 6000));
    }

    if (nowComplete) {
      setPlanStaleInfo({
        isStale: true,
        reason: 'Task marked complete. Recalculate schedule to pull forward remaining tasks.',
      });
      showNotice('Task marked completed.', 'success');
    } else {
      setPlanStaleInfo({
        isStale: true,
        reason: 'Task reopened. Recalculate schedule to allocate time blocks.',
      });
      showNotice('Task marked incomplete and returned to queue.', 'info');
    }
  }, [showNotice, user, cloudReady, tasks]);

  const reopenTask = useCallback((taskId) => {
    const task = tasks.find((item) => item.id === taskId);
    if (user && cloudReady && task) taskApi.update(taskId, { status: TaskStatus.PENDING, remainingDurationMinutes: Math.max(15, task.estimatedDurationMinutes - (task.actualWorkMinutes || 0)), completedAt: null }).catch((error) => showNotice(`Task could not sync to cloud: ${error.message}`, 'warning', 6000));
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const remaining = Math.max(15, t.estimatedDurationMinutes - (t.actualWorkMinutes || 0));
          return {
            ...t,
            status: TaskStatus.PENDING,
            remainingDurationMinutes: remaining,
            completedAt: null,
          };
        }
        return t;
      })
    );

    setPlanStaleInfo({
      isStale: true,
      reason: 'Task reopened. Recalculate schedule to allocate time for this work.',
    });

    showNotice('Task reopened and added back to scheduling queue.', 'info');
  }, [showNotice, tasks, user, cloudReady]);

  // -------------------- SCHEDULING ACTIONS --------------------
  const generatePlan = useCallback((overridePrefs = null) => {
    const prefs = overridePrefs ? { ...preferences, ...overridePrefs } : preferences;
    if (overridePrefs) {
      setPreferences(prefs);
    }
    const newPlan = generateDailySchedule(tasks, prefs, prefs.planDate, new Date());
    setCurrentPlan(newPlan);
    setPlanStaleInfo(null); // Clears stale indicator!

    if (newPlan.validationError) {
      showNotice(newPlan.validationError, 'warning', 6000);
    } else {
      showNotice('Generated schedule using deterministic workload rules.', 'success');
    }
    return newPlan;
  }, [tasks, preferences, showNotice]);

  const applyPlan = useCallback((planObj) => {
    setCurrentPlan(planObj);
    setPlanStaleInfo(null);
    showNotice('Daily plan applied and active.', 'success');
  }, [showNotice]);

  // -------------------- FOCUS SESSION ACTIONS --------------------
  const startFocusSession = useCallback((taskId, customPlannedMinutes = null) => {
    const targetTask = tasks.find((t) => t.id === taskId);
    if (!targetTask) return;

    const remaining = getTaskRemainingMinutes(targetTask);
    const plannedMinutes = customPlannedMinutes || remaining || targetTask.estimatedDurationMinutes || 25;

    const timerObj = {
      sessionId: `sess_${Date.now()}`,
      taskId: targetTask.id,
      taskTitle: targetTask.title,
      plannedDurationMinutes: plannedMinutes,
      startTime: new Date().toISOString(),
      isRunning: true,
      isPaused: false,
      accumulatedSeconds: 0,
      lastResumedTimestamp: Date.now(),
    };

    setActiveTimer(timerObj);
    setLiveElapsedSeconds(0);

    // Switch task status to In Progress
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId && t.status === TaskStatus.PENDING ? { ...t, status: TaskStatus.IN_PROGRESS } : t))
    );

    setCurrentView('focus');
    showNotice(`Focus session started for "${targetTask.title}"`, 'info');
  }, [tasks, showNotice]);

  const pauseFocusSession = useCallback(() => {
    if (!activeTimer || !activeTimer.isRunning || activeTimer.isPaused) return;

    const currentActiveSeconds = calculateCurrentElapsedSeconds(activeTimer);
    setActiveTimer({
      ...activeTimer,
      isPaused: true,
      accumulatedSeconds: currentActiveSeconds,
      lastResumedTimestamp: null,
    });
    setLiveElapsedSeconds(currentActiveSeconds);
    showNotice('Session paused. Paused time is excluded from focus logs.', 'info');
  }, [activeTimer, showNotice]);

  const resumeFocusSession = useCallback(() => {
    if (!activeTimer || !activeTimer.isRunning || !activeTimer.isPaused) return;

    setActiveTimer({
      ...activeTimer,
      isPaused: false,
      lastResumedTimestamp: Date.now(),
    });
    showNotice('Session resumed.', 'info');
  }, [activeTimer, showNotice]);

  const finishFocusSession = useCallback(({ isTaskComplete, remainingMinutes, notes = '' }) => {
    if (!activeTimer) return;

    const totalSeconds = calculateCurrentElapsedSeconds(activeTimer);
    // Explicit documented rounding policy:
    // If >= 30 seconds, round to nearest whole minute (min 1 min).
    // If < 30 seconds, 0 minutes logged.
    const totalMinutes = totalSeconds >= 30 ? Math.max(1, Math.round(totalSeconds / 60)) : 0;
    const nowIso = new Date().toISOString();

    const sessionRecord = createSessionRecord({
      id: activeTimer.sessionId,
      taskId: activeTimer.taskId,
      taskTitle: activeTimer.taskTitle,
      startTime: activeTimer.startTime,
      endTime: nowIso,
      activeDurationSeconds: totalSeconds,
      plannedDurationMinutes: activeTimer.plannedDurationMinutes,
      outcome: isTaskComplete ? SessionOutcome.COMPLETED : SessionOutcome.INCOMPLETE,
      notes,
    });

    // Save session record
    setSessions((prev) => [sessionRecord, ...prev]);
    if (user && cloudReady) sessionApi.create(sessionRecord).catch((error) => showNotice(`Focus session saved locally but cloud sync failed: ${error.message}`, 'warning', 6000));
    const taskBeforeSession = tasks.find((task) => task.id === activeTimer.taskId);
    if (user && cloudReady && taskBeforeSession) {
      const nextRemaining = isTaskComplete ? 0 : remainingMinutes !== undefined && remainingMinutes !== null
        ? Math.max(0, Math.round(Number(remainingMinutes)))
        : Math.max(0, getTaskRemainingMinutes(taskBeforeSession) - totalMinutes);
      taskApi.update(activeTimer.taskId, {
        actualWorkMinutes: (taskBeforeSession.actualWorkMinutes || 0) + totalMinutes,
        remainingDurationMinutes: nextRemaining,
        status: isTaskComplete ? TaskStatus.COMPLETED : TaskStatus.IN_PROGRESS,
        completedAt: isTaskComplete ? nowIso : null,
      }).catch((error) => showNotice(`Task progress could not sync to cloud: ${error.message}`, 'warning', 6000));
    }

    // Update task
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === activeTimer.taskId) {
          const newActual = (t.actualWorkMinutes || 0) + totalMinutes;
          const currentRemaining = getTaskRemainingMinutes(t);
          const newRemaining = isTaskComplete
            ? 0
            : remainingMinutes !== undefined && remainingMinutes !== null
            ? Math.max(0, Math.round(Number(remainingMinutes)))
            : Math.max(0, currentRemaining - totalMinutes);

          return {
            ...t,
            actualWorkMinutes: newActual,
            remainingDurationMinutes: newRemaining,
            status: isTaskComplete ? TaskStatus.COMPLETED : TaskStatus.IN_PROGRESS,
            completedAt: isTaskComplete ? nowIso : null,
          };
        }
        return t;
      })
    );

    setActiveTimer(null);
    setLiveElapsedSeconds(0);

    // If task finished or remaining duration changed, mark schedule stale
    setPlanStaleInfo({
      isStale: true,
      reason: isTaskComplete
        ? `Task completed! Recalculate schedule to pull forward next tasks.`
        : `Focus session recorded (${totalMinutes}m). Recalculate schedule to update remaining workload.`,
    });

    showNotice(`Recorded ${totalMinutes}m focus session.`, 'success');

    return {
      totalMinutes,
      isTaskComplete,
      sessionRecord,
    };
  }, [activeTimer, showNotice, user, cloudReady, tasks]);

  const cancelFocusSession = useCallback(() => {
    if (!activeTimer) return;
    // Consistent Cancellation Policy: Discard active session without altering task state or logging phantom analytics
    setActiveTimer(null);
    setLiveElapsedSeconds(0);
    showNotice('Focus session cancelled. No time recorded.', 'info');
  }, [activeTimer, showNotice]);

  // -------------------- PLAN RECOVERY ACTIONS --------------------
  const triggerPlanRecovery = useCallback((context = {}) => {
    const proposal = analyzePlanRecovery({
      tasks,
      sessions,
      currentPlan,
      preferences,
      recoveryContext: context,
    });
    setRecoveryProposal(proposal);
    setCurrentView('recovery');
    return proposal;
  }, [tasks, sessions, currentPlan, preferences]);

  const acceptRecoveryPlan = useCallback(() => {
    if (!recoveryProposal || !recoveryProposal.revisedPlan) return;
    setCurrentPlan(recoveryProposal.revisedPlan);
    setRecoveryProposal(null);
    setPlanStaleInfo(null); // Clear stale info on acceptance
    setCurrentView('dashboard');
    showNotice('Recovery plan accepted! Today\'s schedule has been repaired.', 'success');
  }, [recoveryProposal, showNotice]);

  const rejectRecoveryPlan = useCallback(() => {
    // Clear the rejected proposal
    setRecoveryProposal(null);
    // Navigate away from recovery view to the planner
    setCurrentView('planner');
    showNotice('Recovery plan declined. Original schedule preserved.', 'info');
  }, [showNotice]);

  const resetAllData = useCallback(() => {
    clearAllStorage();
    setTasks([]);
    setSessions([]);
    setCurrentPlan(null);
    setActiveTimer(null);
    setRecoveryProposal(null);
    setPlanStaleInfo(null);
    setPreferences(defaultPreferences);
    setCurrentView('dashboard');
    showNotice('All data has been reset to empty state.', 'info');
  }, [showNotice]);

  const value = useMemo(
    () => ({
      user,
      authReady,
      authenticate,
      signOut,
      continueAsGuest,
      currentView,
      setCurrentView,
      tasks,
      sessions,
      preferences,
      setPreferences,
      currentPlan,
      planStaleInfo,
      storageWarning,
      activeTimer,
      liveElapsedSeconds,
      recoveryProposal,
      notice,
      addTask,
      updateTask,
      deleteTask,
      toggleTaskComplete,
      reopenTask,
      generatePlan,
      applyPlan,
      startFocusSession,
      pauseFocusSession,
      resumeFocusSession,
      finishFocusSession,
      cancelFocusSession,
      triggerPlanRecovery,
      acceptRecoveryPlan,
      rejectRecoveryPlan,
      resetAllData,
    }),
    [
      user, authReady, authenticate, signOut, continueAsGuest,
      currentView,
      tasks,
      sessions,
      preferences,
      currentPlan,
      planStaleInfo,
      storageWarning,
      activeTimer,
      liveElapsedSeconds,
      recoveryProposal,
      notice,
      addTask,
      updateTask,
      deleteTask,
      toggleTaskComplete,
      reopenTask,
      generatePlan,
      applyPlan,
      startFocusSession,
      pauseFocusSession,
      resumeFocusSession,
      finishFocusSession,
      cancelFocusSession,
      triggerPlanRecovery,
      acceptRecoveryPlan,
      rejectRecoveryPlan,
      resetAllData,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

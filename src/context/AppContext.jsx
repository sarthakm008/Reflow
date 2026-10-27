// CommitZero - Application State Provider
// Pure JavaScript React context with persistent localStorage synchronization

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
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
import {
  getCollegeStudentDemoTasks,
  getDemoPreferences,
  simulateSection16MiddayProgress,
} from '../utils/sampleData.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // Navigation
  const [currentView, setCurrentView] = useState('dashboard');

  // Tasks state
  const [tasks, setTasks] = useState(() => {
    const loaded = loadFromStorage(STORAGE_KEYS.TASKS, null);
    if (loaded && Array.isArray(loaded)) return loaded;
    // By default, initialize with the student demo tasks for immediate exploration
    return getCollegeStudentDemoTasks();
  });

  // Focus sessions state
  const [sessions, setSessions] = useState(() => {
    return loadFromStorage(STORAGE_KEYS.SESSIONS, []);
  });

  // Scheduling Preferences
  const [preferences, setPreferences] = useState(() => {
    const loaded = loadFromStorage(STORAGE_KEYS.PREFERENCES, null);
    return loaded || getDemoPreferences();
  });

  // Current Daily Plan
  const [currentPlan, setCurrentPlan] = useState(() => {
    const loaded = loadFromStorage(STORAGE_KEYS.DAILY_PLAN, null);
    return loaded || null;
  });

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

  // Sync to localStorage
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.TASKS, tasks);
  }, [tasks]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.SESSIONS, sessions);
  }, [sessions]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.PREFERENCES, preferences);
  }, [preferences]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.DAILY_PLAN, currentPlan);
  }, [currentPlan]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.ACTIVE_SESSION, activeTimer);
  }, [activeTimer]);

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
    if (!currentPlan && tasks.length > 0) {
      const plan = generateDailySchedule(tasks, preferences, preferences.planDate);
      setCurrentPlan(plan);
    }
  }, []); // run once on mount

  // -------------------- TASK MANAGEMENT ACTIONS --------------------
  const addTask = useCallback((taskInput) => {
    const validation = validateTaskInput(taskInput);
    if (!validation.isValid) {
      return { success: false, errors: validation.errors };
    }

    const newTask = createTask(taskInput);
    setTasks((prev) => [newTask, ...prev]);
    showNotice(`Created task "${newTask.title}"`, 'success');
    return { success: true, task: newTask };
  }, [showNotice]);

  const updateTask = useCallback((taskId, updates) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const updated = { ...t, ...updates };
          // If remaining duration is updated, ensure it's not negative
          if (updates.remainingDurationMinutes !== undefined) {
            updated.remainingDurationMinutes = Math.max(0, Number(updates.remainingDurationMinutes));
          }
          return updated;
        }
        return t;
      })
    );
    showNotice('Task updated successfully', 'success');
    return { success: true };
  }, [showNotice]);

  const deleteTask = useCallback((taskId) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    // If active timer belongs to this task, cancel timer
    if (activeTimer?.taskId === taskId) {
      setActiveTimer(null);
    }
    // Update daily plan to remove block
    setCurrentPlan((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        blocks: prev.blocks.filter((b) => b.taskId !== taskId),
      };
    });
    showNotice('Task deleted. Session history preserved.', 'info');
  }, [activeTimer, showNotice]);

  const toggleTaskComplete = useCallback((taskId) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const isNowComplete = t.status !== TaskStatus.COMPLETED;
          return {
            ...t,
            status: isNowComplete ? TaskStatus.COMPLETED : TaskStatus.PENDING,
            remainingDurationMinutes: isNowComplete ? 0 : t.estimatedDurationMinutes,
            completedAt: isNowComplete ? new Date().toISOString() : null,
          };
        }
        return t;
      })
    );
  }, []);

  const reopenTask = useCallback((taskId) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            status: TaskStatus.PENDING,
            remainingDurationMinutes: Math.max(15, t.estimatedDurationMinutes - (t.actualWorkMinutes || 0)),
            completedAt: null,
          };
        }
        return t;
      })
    );
    showNotice('Task reopened and added back to scheduling queue.', 'info');
  }, [showNotice]);

  // -------------------- SCHEDULING ACTIONS --------------------
  const generatePlan = useCallback((overridePrefs = null) => {
    const prefs = overridePrefs ? { ...preferences, ...overridePrefs } : preferences;
    if (overridePrefs) {
      setPreferences(prefs);
    }
    const newPlan = generateDailySchedule(tasks, prefs, prefs.planDate);
    setCurrentPlan(newPlan);
    showNotice('Generated schedule using deterministic workload rules.', 'success');
    return newPlan;
  }, [tasks, preferences, showNotice]);

  const applyPlan = useCallback((planObj) => {
    setCurrentPlan(planObj);
    showNotice('Daily plan applied and active.', 'success');
  }, [showNotice]);

  // -------------------- FOCUS SESSION ACTIONS --------------------
  const startFocusSession = useCallback((taskId, customPlannedMinutes = null) => {
    const targetTask = tasks.find((t) => t.id === taskId);
    if (!targetTask) return;

    const plannedMinutes = customPlannedMinutes || targetTask.remainingDurationMinutes || targetTask.estimatedDurationMinutes || 25;

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
    const totalMinutes = Math.max(1, Math.round(totalSeconds / 60));
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

    // Update task
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === activeTimer.taskId) {
          const newActual = (t.actualWorkMinutes || 0) + totalMinutes;
          const newRemaining = isTaskComplete
            ? 0
            : remainingMinutes !== undefined && remainingMinutes !== null
            ? Math.max(0, Number(remainingMinutes))
            : Math.max(0, (t.remainingDurationMinutes || t.estimatedDurationMinutes) - totalMinutes);

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

    showNotice(`Recorded ${totalMinutes}m focus session.`, 'success');

    // Prompt user to inspect Plan Recovery if task was incomplete or took longer
    return {
      totalMinutes,
      isTaskComplete,
      sessionRecord,
    };
  }, [activeTimer, showNotice]);

  const cancelFocusSession = useCallback(() => {
    if (!activeTimer) return;
    const totalSeconds = calculateCurrentElapsedSeconds(activeTimer);
    if (totalSeconds >= 60) {
      // Record partial/abandoned session if worked at least 1 minute
      const sessionRecord = createSessionRecord({
        id: activeTimer.sessionId,
        taskId: activeTimer.taskId,
        taskTitle: activeTimer.taskTitle,
        startTime: activeTimer.startTime,
        endTime: new Date().toISOString(),
        activeDurationSeconds: totalSeconds,
        plannedDurationMinutes: activeTimer.plannedDurationMinutes,
        outcome: SessionOutcome.ABANDONED,
        notes: 'Session cancelled by user.',
      });
      setSessions((prev) => [sessionRecord, ...prev]);
    }
    setActiveTimer(null);
    setLiveElapsedSeconds(0);
    showNotice('Focus session cancelled.', 'info');
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
    setCurrentView('dashboard');
    showNotice('Recovery plan accepted! Today\'s schedule has been repaired.', 'success');
  }, [recoveryProposal, showNotice]);

  const rejectRecoveryPlan = useCallback(() => {
    setRecoveryProposal(null);
    showNotice('Recovery plan declined. Original schedule preserved.', 'info');
  }, [showNotice]);

  // -------------------- DEMO SCENARIO HELPERS --------------------
  const loadDemoScenario = useCallback(() => {
    const demoTasks = getCollegeStudentDemoTasks();
    const demoPrefs = getDemoPreferences();
    setTasks(demoTasks);
    setPreferences(demoPrefs);
    setSessions([]);
    setActiveTimer(null);
    setRecoveryProposal(null);

    // Generate overloaded initial plan
    const initialPlan = generateDailySchedule(demoTasks, demoPrefs, demoPrefs.planDate);
    setCurrentPlan(initialPlan);

    setCurrentView('dashboard');
    showNotice('Loaded College Student Demo Scenario: 4 tasks (480m total) vs 180m available study time.', 'success', 5000);
  }, [showNotice]);

  const runSection16Simulation = useCallback(() => {
    try {
      const result = simulateSection16MiddayProgress(tasks, sessions);
      setTasks(result.updatedTasks);
      setSessions(result.updatedSessions);
      setActiveTimer(null);

      // Trigger recovery with reason
      const proposal = analyzePlanRecovery({
        tasks: result.updatedTasks,
        sessions: result.updatedSessions,
        currentPlan,
        preferences,
        recoveryContext: {
          triggerReason: RecoveryTriggerReason.TASK_RAN_OVER,
          affectedTaskId: 'demo-task-express',
          overrideAvailableMinutes: 90, // 180m initial - 90m worked = 90m left
          useCurrentTimeAsStart: true,
        },
      });

      setRecoveryProposal(proposal);
      setCurrentView('recovery');
      showNotice(
        'Simulated: Worked 90m on Express.js (requires +60m). Plan Recovery generated revised schedule.',
        'info',
        6000
      );
    } catch (err) {
      showNotice(err.message, 'warning');
    }
  }, [tasks, sessions, currentPlan, preferences, showNotice]);

  const resetAllData = useCallback(() => {
    clearAllStorage();
    setTasks([]);
    setSessions([]);
    setCurrentPlan(null);
    setActiveTimer(null);
    setRecoveryProposal(null);
    setPreferences(defaultPreferences);
    setCurrentView('dashboard');
    showNotice('All data has been reset to empty state.', 'info');
  }, [showNotice]);

  const value = useMemo(
    () => ({
      currentView,
      setCurrentView,
      tasks,
      sessions,
      preferences,
      setPreferences,
      currentPlan,
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
      loadDemoScenario,
      runSection16Simulation,
      resetAllData,
    }),
    [
      currentView,
      tasks,
      sessions,
      preferences,
      currentPlan,
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
      loadDemoScenario,
      runSection16Simulation,
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

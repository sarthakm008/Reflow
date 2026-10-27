// CommitZero - Analytics Calculation Engine
// Pure JavaScript, statistical calculations from real recorded task & session history

import { TaskStatus } from '../models/taskModel.js';

export function calculateAnalyticsMetrics(tasks = [], sessions = []) {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === TaskStatus.COMPLETED);
  const inProgressTasks = tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS);
  const pendingTasks = tasks.filter((t) => t.status === TaskStatus.PENDING);

  const completedCount = completedTasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  // Session stats
  const totalSessions = sessions.length;
  const totalFocusSeconds = sessions.reduce((acc, s) => acc + (s.activeDurationSeconds || 0), 0);
  const totalFocusMinutes = Math.round(totalFocusSeconds / 60);

  // Current day sessions vs historical
  const todayStr = new Date().toISOString().split('T')[0];
  const todaySessions = sessions.filter((s) => s.startTime && s.startTime.startsWith(todayStr));
  const todayFocusSeconds = todaySessions.reduce((acc, s) => acc + (s.activeDurationSeconds || 0), 0);
  const todayFocusMinutes = Math.round(todayFocusSeconds / 60);

  // Estimation Accuracy (Ratio of actual work duration to original estimated duration for tasks with recorded work)
  const tasksWithWork = tasks.filter((t) => (t.actualWorkMinutes || 0) > 0 && (t.estimatedDurationMinutes || 0) > 0);
  let totalEstimatedForWorked = 0;
  let totalActualForWorked = 0;

  tasksWithWork.forEach((t) => {
    totalEstimatedForWorked += t.estimatedDurationMinutes;
    totalActualForWorked += t.actualWorkMinutes;
  });

  const underestimationRatio = totalEstimatedForWorked > 0
    ? Number((totalActualForWorked / totalEstimatedForWorked).toFixed(2))
    : 1.0;

  // Tasks completed before deadline vs after/no deadline
  let completedBeforeDeadlineCount = 0;
  let completedAfterDeadlineCount = 0;

  completedTasks.forEach((t) => {
    if (t.deadline && t.completedAt) {
      const deadlineMs = new Date(t.deadline).getTime();
      const completedMs = new Date(t.completedAt).getTime();
      if (completedMs <= deadlineMs) {
        completedBeforeDeadlineCount++;
      } else {
        completedAfterDeadlineCount++;
      }
    }
  });

  // Daily focus distribution (last 7 days)
  const dailyFocusMap = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().split('T')[0];
    const dayLabel = d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
    dailyFocusMap[dateKey] = { date: dateKey, label: dayLabel, minutes: 0, sessions: 0 };
  }

  sessions.forEach((s) => {
    if (s.startTime) {
      const dKey = s.startTime.split('T')[0];
      if (dailyFocusMap[dKey]) {
        dailyFocusMap[dKey].minutes += Math.round((s.activeDurationSeconds || 0) / 60);
        dailyFocusMap[dKey].sessions += 1;
      }
    }
  });

  const dailyFocusSeries = Object.values(dailyFocusMap);

  // Subject/Category breakdown
  const subjectBreakdown = {};
  tasks.forEach((t) => {
    const subj = t.subject || 'General';
    if (!subjectBreakdown[subj]) {
      subjectBreakdown[subj] = { subject: subj, taskCount: 0, actualMinutes: 0, remainingMinutes: 0 };
    }
    subjectBreakdown[subj].taskCount += 1;
    subjectBreakdown[subj].actualMinutes += t.actualWorkMinutes || 0;
    subjectBreakdown[subj].remainingMinutes += t.remainingDurationMinutes || 0;
  });

  // Task accuracy records for comparative table
  const taskAccuracyRecords = tasks
    .filter((t) => (t.actualWorkMinutes || 0) > 0 || t.status === TaskStatus.COMPLETED)
    .map((t) => {
      const est = t.estimatedDurationMinutes || 0;
      const act = t.actualWorkMinutes || 0;
      const diff = act - est;
      const ratio = est > 0 ? Number((act / est).toFixed(2)) : 1;
      return {
        id: t.id,
        title: t.title,
        subject: t.subject,
        status: t.status,
        estimatedDurationMinutes: est,
        actualWorkMinutes: act,
        varianceMinutes: diff,
        ratio,
      };
    });

  return {
    totalTasks,
    completedCount,
    inProgressCount: inProgressTasks.length,
    pendingCount: pendingTasks.length,
    completionRate,
    totalSessions,
    totalFocusMinutes,
    todayFocusMinutes,
    underestimationRatio,
    completedBeforeDeadlineCount,
    completedAfterDeadlineCount,
    dailyFocusSeries,
    subjectBreakdown: Object.values(subjectBreakdown),
    taskAccuracyRecords,
  };
}

import { defaultPreferences } from './storage.js';

const DEMO_TASK_IDS = new Set([
  'demo-task-express',
  'demo-task-mongodb',
  'demo-task-algorithms',
  'demo-task-lecture',
]);

export function removeDemoTasks(tasks = []) {
  return tasks.filter((task) => !DEMO_TASK_IDS.has(task.id));
}

export function removeDemoSessions(sessions = []) {
  return sessions.filter((session) => !DEMO_TASK_IDS.has(session.taskId));
}

export function removeDemoPlan(plan) {
  return plan?.blocks?.some((block) => DEMO_TASK_IDS.has(block.taskId)) ? null : plan;
}

export function removeDemoPreferences(preferences) {
  const legacyDemoPeriod = (preferences.unavailablePeriods || []).some(
    (period) => period.id === 'office-hours' && period.title === 'Prof Office Hours',
  );
  if (legacyDemoPeriod) return { ...defaultPreferences, planDate: preferences.planDate || defaultPreferences.planDate };

  return {
    ...preferences,
    unavailablePeriods: (preferences.unavailablePeriods || []).filter((period) => period.id !== 'office-hours'),
  };
}


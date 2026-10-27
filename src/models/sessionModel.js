// CommitZero - Focus Session Model & Time Tracker
// Pure JavaScript, accurate timestamp-based active time tracking

export const SessionOutcome = {
  COMPLETED: 'Completed',
  INCOMPLETE: 'Incomplete',
  ABANDONED: 'Abandoned',
};

export function createSessionRecord({
  id = null,
  taskId,
  taskTitle,
  startTime,
  endTime = null,
  activeDurationSeconds = 0,
  plannedDurationMinutes = 25,
  outcome = SessionOutcome.COMPLETED,
  notes = '',
}) {
  const activeMinutes = Math.max(0, Math.round(activeDurationSeconds / 60));

  return {
    id: id || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    taskId: taskId || 'unlinked',
    taskTitle: taskTitle || 'Untitled Task',
    startTime: startTime || new Date().toISOString(),
    endTime: endTime || new Date().toISOString(),
    activeDurationSeconds: Math.max(0, Math.round(activeDurationSeconds)),
    activeDurationMinutes: activeMinutes,
    plannedDurationMinutes: Math.max(1, Math.round(Number(plannedDurationMinutes) || 25)),
    outcome: Object.values(SessionOutcome).includes(outcome) ? outcome : SessionOutcome.INCOMPLETE,
    notes: (notes || '').trim(),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Calculates current active seconds for an in-progress timer state.
 * @param {Object} timerState
 * {
 *   isRunning: boolean,
 *   isPaused: boolean,
 *   accumulatedSeconds: number,
 *   lastResumedTimestamp: number | null
 * }
 */
export function calculateCurrentElapsedSeconds(timerState) {
  if (!timerState) return 0;
  const base = timerState.accumulatedSeconds || 0;
  if (timerState.isRunning && !timerState.isPaused && timerState.lastResumedTimestamp) {
    const elapsedSinceResume = Math.floor((Date.now() - timerState.lastResumedTimestamp) / 1000);
    return Math.max(0, base + Math.max(0, elapsedSinceResume));
  }
  return base;
}

export function formatTimeDisplay(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  const pad = (n) => String(n).padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

export function formatMinutesHuman(totalMinutes) {
  const mins = Math.max(0, Math.round(totalMinutes || 0));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

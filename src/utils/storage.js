// CommitZero - Local Storage Persistence Layer
// Pure JavaScript, robust JSON parsing and error recovery

const STORAGE_KEY_PREFIX = 'commitzero_';
const SCHEMA_VERSION = '1.0';

export const STORAGE_KEYS = {
  TASKS: `${STORAGE_KEY_PREFIX}tasks_v${SCHEMA_VERSION}`,
  SESSIONS: `${STORAGE_KEY_PREFIX}sessions_v${SCHEMA_VERSION}`,
  PREFERENCES: `${STORAGE_KEY_PREFIX}preferences_v${SCHEMA_VERSION}`,
  DAILY_PLAN: `${STORAGE_KEY_PREFIX}daily_plan_v${SCHEMA_VERSION}`,
  ACTIVE_SESSION: `${STORAGE_KEY_PREFIX}active_session_v${SCHEMA_VERSION}`,
};

export const defaultPreferences = {
  planDate: new Date().toISOString().split('T')[0],
  startTime: '09:00',
  endTime: '17:00',
  maxDailyMinutes: 180, // Sensible default: 3 hours of focused academic work
  breakDurationMinutes: 10,
  workIntervalMinutes: 50,
  unavailablePeriods: [
    { id: 'lunch-period', title: 'Lunch Break', startTime: '12:30', endTime: '13:30' }
  ],
};

export function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed !== null && parsed !== undefined ? parsed : fallback;
  } catch (err) {
    console.warn(`[CommitZero Storage] Error reading key "${key}":`, err);
    return fallback;
  }
}

export function saveToStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error(`[CommitZero Storage] Error writing key "${key}":`, err);
    return false;
  }
}

export function clearAllStorage() {
  try {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
    return true;
  } catch (err) {
    console.error('[CommitZero Storage] Error clearing storage:', err);
    return false;
  }
}

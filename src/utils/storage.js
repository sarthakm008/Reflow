// CommitZero - Local Storage Persistence Layer
// Pure JavaScript, robust JSON parsing, error recovery, and migration support

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

/**
 * Safely reads a key from localStorage with migration and schema type validation
 */
export function loadFromStorage(key, fallback) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return fallback;
    }

    let raw = window.localStorage.getItem(key);

    // If key not found, check legacy unversioned key before falling back
    if (!raw && key.includes('_v')) {
      const legacyKey = key.split('_v')[0];
      raw = window.localStorage.getItem(legacyKey);
    }

    if (!raw) return fallback;

    const parsed = JSON.parse(raw);
    if (parsed === null || parsed === undefined) return fallback;

    // Validate type compatibility if fallback is array
    if (Array.isArray(fallback) && !Array.isArray(parsed)) {
      console.warn(`[CommitZero Storage] Expected array for "${key}", found:`, typeof parsed);
      return fallback;
    }

    // Validate type compatibility if fallback is plain object
    if (fallback !== null && typeof fallback === 'object' && !Array.isArray(fallback)) {
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        console.warn(`[CommitZero Storage] Expected object for "${key}", found:`, typeof parsed);
        return fallback;
      }
    }

    return parsed;
  } catch (err) {
    console.warn(`[CommitZero Storage] Error reading key "${key}":`, err);
    return fallback;
  }
}

/**
 * Safely saves data to localStorage
 * @returns {boolean} true if write succeeded, false if quota exceeded or error occurred
 */
export function saveToStorage(key, data) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    window.localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error(`[CommitZero Storage] Error writing key "${key}":`, err);
    return false;
  }
}

export function clearAllStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    Object.values(STORAGE_KEYS).forEach((key) => {
      window.localStorage.removeItem(key);
      // Also clean up any legacy unversioned keys
      if (key.includes('_v')) {
        window.localStorage.removeItem(key.split('_v')[0]);
      }
    });
    return true;
  } catch (err) {
    console.error('[CommitZero Storage] Error clearing storage:', err);
    return false;
  }
}

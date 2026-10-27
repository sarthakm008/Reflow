const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}/api${path}`, {
    credentials: 'include',
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
  });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.error?.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.code = body?.error?.code;
    error.details = body?.error?.details;
    throw error;
  }
  return body;
}

export const authApi = {
  me: () => apiRequest('/auth/me'),
  login: (credentials) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  register: (details) => apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(details) }),
  logout: () => apiRequest('/auth/logout', { method: 'POST' }),
};

export const taskApi = {
  list: () => apiRequest('/tasks'),
  create: (task) => apiRequest('/tasks', { method: 'POST', body: JSON.stringify(task) }),
  update: (id, updates) => apiRequest(`/tasks/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  remove: (id) => apiRequest(`/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
export const sessionApi = {
  list: () => apiRequest('/sessions'),
  create: (session) => apiRequest('/sessions', { method: 'POST', body: JSON.stringify(session) }),
};
export const userApi = {
  getPreferences: () => apiRequest('/user/preferences'),
  updatePreferences: (preferences) => apiRequest('/user/preferences', { method: 'PUT', body: JSON.stringify({ preferences }) }),
  getPlan: (date) => apiRequest(`/user/plans/${encodeURIComponent(date)}`),
  savePlan: (planDate, plan) => apiRequest('/user/plans', { method: 'PUT', body: JSON.stringify({ planDate, plan }) }),
};

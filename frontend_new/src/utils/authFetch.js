/**
 * Authenticated fetch utility.
 * Wraps the native fetch() to automatically attach the JWT access token
 * from localStorage. If a 401 is received, attempts a token refresh.
 * If refresh also fails, redirects to login.
 */
const API_BASE = import.meta.env.VITE_API_URL || 'https://classguard-backend-4php.onrender.com';

function getAuthHeaders() {
  const token = localStorage.getItem('access');
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function refreshAccessToken() {
  const refresh = localStorage.getItem('refresh');
  if (!refresh) return false;

  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem('access', data.access);
    return true;
  } catch {
    return false;
  }
}

/**
 * Authenticated fetch wrapper.
 * Usage: const res = await authFetch('/api/v1/alerts/');
 *        const res = await authFetch('/api/v1/alerts/', { method: 'POST', body: ... });
 */
export async function authFetch(url, options = {}) {
  const headers = {
    ...getAuthHeaders(),
    ...(options.headers || {}),
  };

  // Don't set Content-Type for FormData (browser sets multipart boundary automatically)
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
  let res = await fetch(fullUrl, { ...options, headers });

  // If 401, try refreshing the token once
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const retryHeaders = {
        ...getAuthHeaders(),
        ...(options.headers || {}),
      };
      if (options.body && !(options.body instanceof FormData) && !retryHeaders['Content-Type']) {
        retryHeaders['Content-Type'] = 'application/json';
      }
      res = await fetch(fullUrl, { ...options, headers: retryHeaders });
    }

    // If still 401, redirect to login
    if (res.status === 401) {
      localStorage.removeItem('access');
      localStorage.removeItem('refresh');
      window.location.href = '/login';
      return res;
    }
  }

  return res;
}

export default authFetch;

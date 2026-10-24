// Browser side of staff sign-in: keeps the session token and attaches it to every /api call.

export const SESSION_HEADER = 'x-portal-session';
const STORAGE_KEY = 'bpso_portal_session_token';
export const AUTH_REQUIRED_EVENT = 'portal-auth-required';

export interface PortalSessionUser {
  staffId: string;
  name: string;
  role: 'owner' | 'admin' | 'staff';
}

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token: string | null) {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, token);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private browsing: the session lasts for this tab only
  }
}

let installed = false;

/** Adds the session header to same-origin /api requests and reports when the server asks to sign in. */
export function installPortalFetch() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const isApi = url.startsWith('/api/') || url.startsWith(`${window.location.origin}/api/`);
    if (!isApi) return original(input, init);

    const token = getSessionToken();
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    if (token && !headers.has(SESSION_HEADER)) headers.set(SESSION_HEADER, token);
    const res = await original(input, { ...init, headers });
    if (res.status === 401 && !url.includes('/api/auth/login') && !url.includes('/api/meta/webhook')) {
      const body = await res.clone().json().catch(() => null);
      if (body?.authRequired) window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
    }
    return res;
  };
}

export function deviceInfo() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return {
    deviceType: /iPad|Tablet/i.test(ua) ? 'tablet' : /Android|iPhone|iPod|Mobile/i.test(ua) ? 'mobile' : 'desktop',
    deviceName: /iPhone/i.test(ua) ? 'iPhone' : /iPad/i.test(ua) ? 'iPad' : /Android/i.test(ua) ? 'Android Phone' : 'Browser',
  };
}

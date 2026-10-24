import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { AUTH_REQUIRED_EVENT, PortalSessionUser, deviceInfo, getSessionToken, setSessionToken } from '../utils/portalAuth';

export interface PortalAuthContext {
  authEnabled: boolean;
  portalUser: PortalSessionUser | null;
  signOut: () => void;
}

interface LoginGateProps {
  children: (ctx: PortalAuthContext) => React.ReactNode;
}

type GateState = 'checking' | 'signed_in' | 'needs_code' | 'open';

/** Shows the access-code screen when sign-in is switched on, otherwise renders the portal straight away. */
export const LoginGate: React.FC<LoginGateProps> = ({ children }) => {
  const [state, setState] = useState<GateState>('checking');
  const [user, setUser] = useState<PortalSessionUser | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const login = useCallback(async (accessCode: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: accessCode, ...deviceInfo() }),
      });
      const data: any = await res.json().catch(() => ({}));
      if (res.ok && data.authEnabled === false) {
        setState('open');
        return;
      }
      if (!res.ok || !data.token) {
        setError(data.error || 'That access code did not work.');
        setState('needs_code');
        return;
      }
      setSessionToken(data.token);
      setUser(data.user);
      setState('signed_in');
      setCode('');
    } catch {
      setError('Could not reach the portal. Check the internet connection and try again.');
      setState('needs_code');
    } finally {
      setSubmitting(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get('invite');
    // Old QR links carried passcodes in the address; drop them from the address bar
    if (invite || params.get('token') || params.get('auth')) {
      window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
    }

    (async () => {
      try {
        const res = await fetch('/api/auth/status');
        const data: any = await res.json().catch(() => ({}));
        if (!data.authEnabled) {
          setState('open');
          return;
        }
        if (data.user) {
          setUser(data.user);
          setState('signed_in');
          return;
        }
        if (getSessionToken()) setSessionToken(null); // expired or revoked
        if (invite) await login(invite);
        else setState('needs_code');
      } catch {
        setState('open'); // server unreachable: let the portal show its own offline state
      }
    })();

    const onAuthRequired = () => {
      setSessionToken(null);
      setUser(null);
      setState('needs_code');
    };
    window.addEventListener(AUTH_REQUIRED_EVENT, onAuthRequired);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, onAuthRequired);
  }, [login]);

  const signOut = useCallback(() => {
    setSessionToken(null);
    setUser(null);
    setState('needs_code');
  }, []);

  if (state === 'checking') {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-neutral-400 text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading portal…
      </div>
    );
  }

  if (state === 'needs_code') {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) void login(code.trim());
          }}
          className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5 shadow-2xl"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500 to-orange-400" />
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">Bangkok Plus Size OOTD</h1>
              <p className="text-neutral-400 text-xs">Staff portal sign-in</p>
            </div>
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs text-neutral-300 font-medium">Access code</span>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                autoFocus
                name="access-code"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. K7QM-2XRP-9TDA"
                className="w-full pl-9 pr-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-rose-500 uppercase tracking-wider"
              />
            </div>
          </label>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !code.trim()}
            className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 transition"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Sign in
          </button>
          <p className="text-[11px] text-neutral-500 leading-relaxed">
            Admins: open the phone link the owner sent you, or type the code from it. Owner: use the owner access code saved in Vercel.
          </p>
        </form>
      </div>
    );
  }

  return <>{children({ authEnabled: state === 'signed_in', portalUser: user, signOut })}</>;
};

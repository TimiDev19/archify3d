'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { LoaderCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ToastProvider';

type AuthMode = 'signup' | 'signin' | 'recover' | 'reset';

function friendlyError(error: unknown) {
  if (error instanceof Error) {
    const message = error.message;
    if (/invalid login credentials/i.test(message)) return 'That email and password combination was not recognized.';
    if (/email not confirmed/i.test(message)) return 'Verify your email before signing in. Check your inbox for the confirmation link.';
    if (/user already registered/i.test(message)) return 'An account already exists for this email. Try signing in instead.';
    if (/fetch failed|failed to fetch|network/i.test(message)) return 'Could not reach Supabase. Check your connection and project configuration, then try again.';
    return message;
  }
  return 'Request failed. Try again.';
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'status' | 'error'>('status');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('auth_error');
    if (!authError) return;
    setMessageType('error');
    setMessage('We could not complete that authentication link. It may have expired; request a new one and try again.');
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const db = createClient();
      if (mode === 'signup') {
        const { data, error } = await db.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/auth/callback` } });
        if (error) throw error;
        if (data.session) location.assign('/dashboard');
        else location.assign('/auth/verify-email');
      } else if (mode === 'signin') {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        location.assign('/dashboard');
      } else if (mode === 'reset') {
        const { error } = await db.auth.updateUser({ password });
        if (error) throw error;
        setMessageType('status');
        setMessage('Password updated. You can now sign in.');
        toast('Your password was updated.', 'success');
      } else {
        const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/auth/callback?next=/auth/reset` });
        if (error) throw error;
        setMessageType('status');
        setMessage('If an account exists for that email, a recovery link has been sent.');
        toast('If the account exists, a recovery link is on its way.', 'success');
      }
    } catch (error) {
      setMessageType('error');
      const errorMessage = friendlyError(error);
      setMessage(errorMessage);
      toast(errorMessage, 'error');
    } finally {
      setBusy(false);
    }
  }

  return <div style={{ display: 'grid', gap: 16 }}>
    <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
      {mode !== 'reset' && <label>Email address
        <input className="input" type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} style={{ marginTop: 6 }} />
      </label>}
      {mode !== 'recover' && <label>{mode === 'reset' ? 'New password' : 'Password'}
        <input className="input" type="password" minLength={8} required autoComplete={mode === 'signup' || mode === 'reset' ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} style={{ marginTop: 6 }} />
        <small style={{ color: 'var(--muted)' }}>Use at least 8 characters.</small>
      </label>}
      <button className="btn primary" disabled={busy} aria-busy={busy}>{busy && <LoaderCircle size={16} className="loading-spinner"/>}{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'signin' ? 'Sign in' : mode === 'reset' ? 'Update password' : 'Send recovery link'}</button>
    </form>
    {message && <p role={messageType === 'error' ? 'alert' : 'status'} className={messageType === 'error' ? 'auth-error' : 'auth-status'}>{message}</p>}
  </div>;
}

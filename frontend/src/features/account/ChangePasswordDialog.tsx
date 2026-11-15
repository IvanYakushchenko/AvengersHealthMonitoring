// Code was assisted with Claude.
import { useState, type FormEvent } from 'react';
import { KeyRound, X } from 'lucide-react';
import { ApiError, authApi } from '../../api/healthApi';

// Same minimum as the backend's password rule.
const MIN_PASSWORD_LENGTH = 8;

// Props of the password dialog: the login token and what to do on cancel or success.
interface ChangePasswordDialogProps {
  token: string;
  onCancel: () => void;
  // Called after the change. The backend logs out every session, so the caller ends this one.
  onDone: () => void;
}

// Lets the logged-in user change their own password.
export function ChangePasswordDialog({ token, onCancel, onDone }: ChangePasswordDialogProps) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!current) return setError('Enter your current password.');
    if (next.length < MIN_PASSWORD_LENGTH)
      return setError(`The new password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    if (next !== repeat) return setError("The new passwords don't match.");

    setSaving(true);
    setError(null);
    try {
      await authApi.changePassword(token, current, next);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not change the password.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'px-2.5 py-1.5 text-sm text-slate-200 bg-night border border-white/15 rounded-md focus:outline-none focus:border-brand';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl border border-white/10 bg-panel p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-200">
            <KeyRound className="w-4 h-4 text-brand-light" />
            Change password
          </h2>
          <button type="button" onClick={onCancel} aria-label="Close" className="p-1 text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="flex flex-col gap-1 text-[11px] text-slate-400">
          Current password
          <input type="password" className={inputClass} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-slate-400">
          New password (at least {MIN_PASSWORD_LENGTH} characters)
          <input type="password" className={inputClass} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-slate-400">
          Repeat new password
          <input type="password" className={inputClass} value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" />
        </label>

        {error && <p className="text-xs text-red-300">{error}</p>}
        <p className="text-[11px] text-slate-500">You will be logged out everywhere and must log in again.</p>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-md bg-ink-soft border border-white/10 text-xs font-medium text-slate-200 cursor-pointer">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-3 py-1.5 rounded-md bg-brand text-white text-xs font-medium hover:bg-brand-dark cursor-pointer disabled:opacity-60">
            {saving ? 'Saving…' : 'Change password'}
          </button>
        </div>
      </form>
    </div>
  );
}

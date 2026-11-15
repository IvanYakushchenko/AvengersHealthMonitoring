import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, AlertTriangle, ShieldAlert, Minus, LogOut, KeyRound, Eye, Trash2, UserPlus } from 'lucide-react';
import {
  adminApi,
  ApiError,
  isUnauthorized,
  type BackendStatus,
  type CrewMember,
  type Sex,
} from '../../api/healthApi';

// Props of the mission control page: the login, the crew it manages, and the actions.
interface AdminPageProps {
  token: string;
  username: string;
  crewName: string | null;
  onOpenCrew: (member: CrewMember) => void;
  onChangePassword: () => void;
  onLogout: () => void;
  onSessionExpired: () => void;
}

// Same username rule as the backend (3-30 letters, digits, "_", "." or "-").
const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,30}$/;
// Same minimum as the backend's password rule.
const MIN_PASSWORD_LENGTH = 8;

// The message to show for an error: the server's text when there is one, otherwise the fallback.
function describe(err: unknown, fallback: string) {
  return err instanceof ApiError || err instanceof Error ? err.message : fallback;
}

// The coloured badge for a crew member's overall status.
function StatusBadge({ status }: { status: BackendStatus }) {
  if (status === 'urgent') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-danger/15 text-danger">
        <ShieldAlert className="w-3.5 h-3.5" />
        Alert
      </span>
    );
  }
  if (status === 'caution') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300">
        <AlertTriangle className="w-3.5 h-3.5" />
        Trend Watch
      </span>
    );
  }
  if (status === 'unknown') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-300">
        <Minus className="w-3.5 h-3.5" />
        No data
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300">
      <CheckCircle2 className="w-3.5 h-3.5" />
      Nominal
    </span>
  );
}

// Shared styles for the buttons on this page.
const buttonClass =
  'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-panel border border-white/10 hover:border-brand text-xs font-medium text-slate-200 transition-colors cursor-pointer disabled:opacity-60';

// Mission control: the crew list, with create, password reset, delete and an overview per crew member.
export function AdminPage({
  token,
  username,
  crewName,
  onOpenCrew,
  onChangePassword,
  onLogout,
  onSessionExpired,
}: AdminPageProps) {
  const [crew, setCrew] = useState<CrewMember[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newSex, setNewSex] = useState<Sex | ''>('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [resetId, setResetId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setCrew(await adminApi.listCrew(token));
      setListError(null);
    } catch (err) {
      if (isUnauthorized(err)) {
        onSessionExpired();
        return;
      }
      setListError(describe(err, 'Could not load the crew list.'));
    }
  }, [token, onSessionExpired]);

  useEffect(() => {
    void load();
  }, [load]);

  // Runs a request, reports errors with the given message, and reloads the list after success.
  const run = async (action: () => Promise<unknown>, onError: (message: string) => void, fallback: string) => {
    setBusy(true);
    try {
      await action();
      await load();
      return true;
    } catch (err) {
      if (isUnauthorized(err)) {
        onSessionExpired();
        return false;
      }
      onError(describe(err, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newUsername.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(name)) {
      setCreateError("Username must be 3-30 letters, digits, '_', '.' or '-' (no spaces).");
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setCreateError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (!newSex) {
      setCreateError('Choose male or female. It decides which 3D body model the crew member sees.');
      return;
    }
    setCreateError(null);
    const sex = newSex;
    const ok = await run(
      () => adminApi.createCrew(token, name, newPassword, sex),
      setCreateError,
      'Could not create the account.',
    );
    if (ok) {
      setNewUsername('');
      setNewPassword('');
      setNewSex('');
    }
  };

  const handleReset = async (member: CrewMember) => {
    if (resetPassword.length < MIN_PASSWORD_LENGTH) {
      setResetError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setResetError(null);
    const ok = await run(
      () => adminApi.resetPassword(token, member.astronautId, resetPassword),
      setResetError,
      'Could not reset the password.',
    );
    if (ok) {
      setResetId(null);
      setResetPassword('');
    }
  };

  const handleDelete = async (member: CrewMember) => {
    if (!window.confirm(`Delete ${member.username} and all their readings? This cannot be undone.`)) return;
    await run(
      () => adminApi.deleteCrew(token, member.astronautId),
      setListError,
      'Could not delete the account.',
    );
  };

  const inputClass =
    'px-2.5 py-1.5 text-sm text-slate-200 bg-panel border border-white/15 rounded-md focus:outline-none focus:border-brand';

  return (
    <div className="starfield min-h-screen text-slate-200 flex flex-col">
      <header className="bg-night/80 backdrop-blur text-slate-200 border-b border-white/10 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-sm sm:text-base tracking-tight">Mission Control</h1>
            <p className="text-xs text-slate-400">{crewName ? `Crew: ${crewName} · ` : ''}Signed in as {username}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onChangePassword} className={buttonClass}>
              <KeyRound className="w-3.5 h-3.5" />
              Password
            </button>
            <button onClick={onLogout} className={buttonClass}>
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Create a crew account */}
        <section className="bg-panel rounded-2xl border border-white/10 p-5">
          <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-brand-light" />
            Create crew account
          </h2>
          <form onSubmit={handleCreate} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_8rem_auto] sm:items-end">
            <label className="flex flex-col gap-1 text-[11px] text-slate-400">
              Username
              <input
                className={inputClass}
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-slate-400">
              Temporary password (at least {MIN_PASSWORD_LENGTH} characters)
              <input
                type="password"
                className={inputClass}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-slate-400">
              Sex (3D model)
              <select
                className={inputClass}
                value={newSex}
                onChange={(e) => setNewSex(e.target.value as Sex | '')}
              >
                <option value="">Choose…</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={busy}
              className="px-3 py-1.5 rounded-md bg-brand text-white text-sm font-medium hover:bg-brand-dark cursor-pointer disabled:opacity-60"
            >
              Create account
            </button>
          </form>
          {createError && <p className="mt-2 text-xs text-red-300">{createError}</p>}
        </section>

        {/* Crew list */}
        <section className="space-y-3">
          <div className="border-b border-brand-light/30 pb-2">
            <h2 className="text-lg font-bold text-slate-200">Crew</h2>
            <p className="text-xs text-slate-500">Overall status is the worst of each member's newest readings</p>
          </div>

          {listError && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-slate-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
              {listError}
            </div>
          )}

          {crew === null && !listError && <p className="text-xs text-slate-400">Loading crew…</p>}
          {crew !== null && crew.length === 0 && (
            <p className="text-sm text-slate-400">No crew accounts yet.</p>
          )}

          <ul className="space-y-3">
            {crew?.map((member) => (
              <li key={member.astronautId} className="bg-panel rounded-xl border border-white/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-slate-200">{member.username}</p>
                    <p className="text-[11px] text-slate-400">
                      {member.sex === 'female' ? 'Female' : 'Male'} · added {new Date(member.createdAt).toLocaleDateString()} · {member.alertCount} alert
                      {member.alertCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={member.status} />
                    <button onClick={() => onOpenCrew(member)} className={buttonClass}>
                      <Eye className="w-3.5 h-3.5 text-brand-light" />
                      Open
                    </button>
                    <button
                      onClick={() => {
                        setResetError(null);
                        setResetPassword('');
                        setResetId(resetId === member.astronautId ? null : member.astronautId);
                      }}
                      className={buttonClass}
                    >
                      <KeyRound className="w-3.5 h-3.5 text-brand-light" />
                      Reset password
                    </button>
                    <button onClick={() => handleDelete(member)} disabled={busy} className={`${buttonClass} hover:border-danger`}>
                      <Trash2 className="w-3.5 h-3.5 text-danger" />
                      Delete
                    </button>
                  </div>
                </div>

                {resetId === member.astronautId && (
                  <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-white/10 pt-3">
                    <label className="flex flex-col gap-1 text-[11px] text-slate-400">
                      New password for {member.username}
                      <input
                        type="password"
                        className={inputClass}
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleReset(member)}
                      className="px-3 py-1.5 rounded-md bg-brand text-white text-xs font-medium hover:bg-brand-dark cursor-pointer disabled:opacity-60"
                    >
                      Set password
                    </button>
                    {resetError && <p className="w-full text-xs text-red-300">{resetError}</p>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

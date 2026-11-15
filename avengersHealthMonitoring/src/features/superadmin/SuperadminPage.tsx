import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Activity, Building2, KeyRound, LogOut, Plus, Trash2, UserPlus, Users } from 'lucide-react';
import {
  isUnauthorized,
  superadminApi,
  superadminMemberSource,
  type Crew,
  type CrewAdmin,
  type CrewMemberInfo,
} from '../../api/healthApi';
import { IndicationsPage } from '../indications';

interface SuperadminPageProps {
  token: string;
  username: string;
  onChangePassword: () => void;
  onLogout: () => void;
  onSessionExpired: () => void;
}

// Same username rule as the backend (3-30 letters, digits, "_", "." or "-").
const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,30}$/;
const MIN_PASSWORD_LENGTH = 8;

const buttonClass =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink-soft hover:bg-panel/10 border border-white/10 text-xs font-medium text-slate-200 transition-colors cursor-pointer disabled:opacity-60';
const inputClass =
  'px-2.5 py-1.5 text-sm text-slate-200 bg-panel border border-white/15 rounded-md focus:outline-none focus:border-brand';

function errorText(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

// Superadmin: create crews, and create the mission control account of each crew.
export function SuperadminPage({ token, username, onChangePassword, onLogout, onSessionExpired }: SuperadminPageProps) {
  const [crews, setCrews] = useState<Crew[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newCrewName, setNewCrewName] = useState('');
  const [crewError, setCrewError] = useState<string | null>(null);
  const [openCrewId, setOpenCrewId] = useState<number | null>(null);
  const [admins, setAdmins] = useState<CrewAdmin[]>([]);
  const [members, setMembers] = useState<CrewMemberInfo[]>([]);
  // The crew member whose health is open (read-only), with the crew it belongs to.
  const [viewing, setViewing] = useState<{ crew: Crew; member: CrewMemberInfo } | null>(null);
  const [resetMemberId, setResetMemberId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [memberMessage, setMemberMessage] = useState<string | null>(null);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Read-only health view of the member being viewed. Memoised so the health data loads once.
  const viewSource = useMemo(
    () => (viewing ? superadminMemberSource(token, viewing.crew.crewId, viewing.member.astronautId) : null),
    [token, viewing],
  );

  // Shows errors, and ends the session when the token is no longer valid.
  const handleError = useCallback(
    (err: unknown, fallback: string, show: (message: string) => void) => {
      if (isUnauthorized(err)) onSessionExpired();
      else show(errorText(err, fallback));
    },
    [onSessionExpired],
  );

  const loadCrews = useCallback(async () => {
    try {
      setCrews(await superadminApi.listCrews(token));
      setLoadError(null);
    } catch (err) {
      handleError(err, 'Could not load the crews.', setLoadError);
    }
  }, [token, handleError]);

  useEffect(() => {
    void loadCrews();
  }, [loadCrews]);

  const loadAdmins = async (crewId: number) => {
    try {
      setAdmins(await superadminApi.listCrewAdmins(token, crewId));
    } catch (err) {
      handleError(err, 'Could not load the mission control accounts.', setAdminError);
    }
  };

  const loadMembers = async (crewId: number) => {
    try {
      setMembers(await superadminApi.listCrewMembers(token, crewId));
    } catch (err) {
      handleError(err, 'Could not load the crew members.', setAdminError);
    }
  };

  const openCrew = (crewId: number) => {
    setAdminError(null);
    setAdminUsername('');
    setAdminPassword('');
    setResetMemberId(null);
    setMemberMessage(null);
    if (openCrewId === crewId) {
      setOpenCrewId(null);
      return;
    }
    setOpenCrewId(crewId);
    void loadAdmins(crewId);
    void loadMembers(crewId);
  };

  const handleDeleteCrew = async (crew: Crew) => {
    if (!window.confirm(`Delete the crew "${crew.name}"? This cannot be undone.`)) return;
    setBusy(true);
    setLoadError(null);
    try {
      await superadminApi.deleteCrew(token, crew.crewId);
      setOpenCrewId(null);
      await loadCrews();
    } catch (err) {
      handleError(err, 'Could not delete the crew.', setLoadError);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteMember = async (crew: Crew, member: CrewMemberInfo) => {
    if (!window.confirm(`Delete ${member.username} and all their readings? This cannot be undone.`)) return;
    setBusy(true);
    setMemberMessage(null);
    try {
      await superadminApi.deleteMember(token, crew.crewId, member.astronautId);
      await loadMembers(crew.crewId);
      await loadCrews();
    } catch (err) {
      handleError(err, 'Could not delete the crew member.', setMemberMessage);
    } finally {
      setBusy(false);
    }
  };

  const handleResetMember = async (crewId: number, astronautId: number) => {
    if (resetPassword.length < MIN_PASSWORD_LENGTH) {
      setMemberMessage(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setBusy(true);
    setMemberMessage(null);
    try {
      await superadminApi.resetMemberPassword(token, crewId, astronautId, resetPassword);
      setResetMemberId(null);
      setResetPassword('');
      setMemberMessage('Password changed. The member must log in again with the new password.');
    } catch (err) {
      handleError(err, 'Could not reset the password.', setMemberMessage);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateCrew = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newCrewName.trim();
    if (name.length < 2) {
      setCrewError('Crew name must be at least 2 characters.');
      return;
    }
    setBusy(true);
    setCrewError(null);
    try {
      await superadminApi.createCrew(token, name);
      setNewCrewName('');
      await loadCrews();
    } catch (err) {
      handleError(err, 'Could not create the crew.', setCrewError);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateAdmin = async (event: FormEvent<HTMLFormElement>, crewId: number) => {
    event.preventDefault();
    const name = adminUsername.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(name)) {
      setAdminError("Username must be 3-30 letters, digits, '_', '.' or '-' (no spaces).");
      return;
    }
    if (adminPassword.length < MIN_PASSWORD_LENGTH) {
      setAdminError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setBusy(true);
    setAdminError(null);
    try {
      await superadminApi.createCrewAdmin(token, crewId, name, adminPassword);
      setAdminUsername('');
      setAdminPassword('');
      await loadAdmins(crewId);
      await loadCrews();
    } catch (err) {
      handleError(err, 'Could not create the account.', setAdminError);
    } finally {
      setBusy(false);
    }
  };

  if (viewing && viewSource) {
    return (
      <IndicationsPage
        key={viewing.member.astronautId}
        source={viewSource}
        crewLabel={`${viewing.crew.name}: ${viewing.member.username}`}
        sex={viewing.member.sex}
        canLog={false}
        onBack={() => setViewing(null)}
        onChangePassword={onChangePassword}
        onLogout={onLogout}
        onSessionExpired={onSessionExpired}
      />
    );
  }

  return (
    <div className="starfield min-h-screen text-slate-200 flex flex-col">
      <header className="bg-night/80 backdrop-blur text-slate-200 border-b border-white/10 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-sm sm:text-base tracking-tight">Superadmin</h1>
            <p className="text-xs text-slate-400">Signed in as {username}</p>
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
        {/* Create a crew */}
        <section className="bg-panel rounded-2xl border border-white/10 p-5">
          <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-brand-light" />
            Create crew
          </h2>
          <form onSubmit={handleCreateCrew} className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[11px] text-slate-400">
              Crew name
              <input className={inputClass} value={newCrewName} onChange={(e) => setNewCrewName(e.target.value)} />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand text-white text-sm font-medium hover:bg-brand-dark cursor-pointer disabled:opacity-60"
            >
              <Plus className="w-4 h-4" />
              Create crew
            </button>
          </form>
          {crewError && <p className="mt-2 text-xs text-red-300">{crewError}</p>}
        </section>

        {/* Crews */}
        <section className="space-y-3">
          <div className="border-b border-brand-light/30 pb-2">
            <h2 className="text-lg font-bold text-slate-200">Crews</h2>
            <p className="text-xs text-slate-500">Open a crew to create its mission control account</p>
          </div>
          {loadError && <p className="text-sm text-red-300">{loadError}</p>}
          {crews === null && !loadError && <p className="text-xs text-slate-400">Loading crews…</p>}
          {crews !== null && crews.length === 0 && <p className="text-sm text-slate-400">No crews yet.</p>}

          <ul className="space-y-3">
            {crews?.map((crew) => (
              <li key={crew.crewId} className="bg-panel rounded-xl border border-white/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-200">{crew.name}</p>
                    <p className="text-[11px] text-slate-400 flex items-center gap-3">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{crew.memberCount} crew</span>
                      <span className="flex items-center gap-1"><KeyRound className="w-3 h-3" />{crew.adminCount} mission control</span>
                    </p>
                  </div>
                  <button onClick={() => openCrew(crew.crewId)} className={buttonClass}>
                    {openCrewId === crew.crewId ? 'Close' : 'Manage'}
                  </button>
                </div>

                {openCrewId === crew.crewId && (
                  <div className="mt-4 border-t border-white/10 pt-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3">
                      <p className="text-xs text-slate-300">
                        {crew.memberCount + crew.adminCount === 0
                          ? 'This crew is empty and can be deleted.'
                          : 'Remove all members and mission control accounts before deleting this crew.'}
                      </p>
                      <button
                        type="button"
                        disabled={busy || crew.memberCount + crew.adminCount > 0}
                        onClick={() => handleDeleteCrew(crew)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-danger/80 text-white text-xs font-medium hover:bg-danger cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete crew
                      </button>
                    </div>

                    <p className="text-xs font-semibold text-slate-300">Crew members</p>
                    {members.length === 0 ? (
                      <p className="text-xs text-slate-500">No crew members yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {members.map((member) => (
                          <li key={member.astronautId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            <span className="font-mono text-slate-200">
                              {member.username}
                              <span className="ml-2 text-[11px] text-slate-400">
                                {member.sex === 'female' ? 'Female' : member.sex === 'male' ? 'Male' : 'No sex set'} · joined{' '}
                                {new Date(member.createdAt).toLocaleDateString()}
                              </span>
                            </span>
                            <span className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setViewing({ crew, member })}
                              className={buttonClass}
                            >
                              <Activity className="w-3.5 h-3.5 text-brand-light" />
                              View health
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleDeleteMember(crew, member)}
                              className={`${buttonClass} hover:border-danger disabled:opacity-60`}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-danger" />
                              Delete
                            </button>
                            {resetMemberId === member.astronautId ? (
                              <span className="flex items-center gap-2">
                                <input
                                  type="password"
                                  className={inputClass}
                                  placeholder="New password"
                                  value={resetPassword}
                                  onChange={(e) => setResetPassword(e.target.value)}
                                  autoComplete="new-password"
                                />
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => handleResetMember(crew.crewId, member.astronautId)}
                                  className="px-2.5 py-1.5 rounded-md bg-brand text-white text-xs font-medium hover:bg-brand-dark cursor-pointer disabled:opacity-60"
                                >
                                  Save
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setMemberMessage(null);
                                  setResetPassword('');
                                  setResetMemberId(member.astronautId);
                                }}
                                className={buttonClass}
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                                Set new password
                              </button>
                            )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {memberMessage && <p className="text-xs text-slate-300">{memberMessage}</p>}

                    <p className="text-xs font-semibold text-slate-300 pt-2">Mission control of {crew.name}</p>
                    {admins.length === 0 ? (
                      <p className="text-xs text-slate-500">No mission control account yet.</p>
                    ) : (
                      <ul className="text-sm text-slate-300 space-y-1">
                        {admins.map((admin) => (
                          <li key={admin.astronautId} className="font-mono">{admin.username}</li>
                        ))}
                      </ul>
                    )}
                    <form onSubmit={(e) => handleCreateAdmin(e, crew.crewId)} className="flex flex-wrap items-end gap-3">
                      <label className="flex flex-col gap-1 text-[11px] text-slate-400">
                        Username
                        <input className={inputClass} value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} autoComplete="off" />
                      </label>
                      <label className="flex flex-col gap-1 text-[11px] text-slate-400">
                        Temporary password (at least {MIN_PASSWORD_LENGTH})
                        <input type="password" className={inputClass} value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} autoComplete="new-password" />
                      </label>
                      <button
                        type="submit"
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand text-white text-xs font-medium hover:bg-brand-dark cursor-pointer disabled:opacity-60"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Create mission control
                      </button>
                    </form>
                    {adminError && <p className="text-xs text-red-300">{adminError}</p>}
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

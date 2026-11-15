// Code was assisted with Claude.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, RotateCcw, Save } from 'lucide-react';
import { isUnauthorized, superadminApi, type PersonalRangeRow } from '../../api/healthApi';

// Props of the personal ranges panel: which crew member, and how to go back.
interface PersonalRangesPanelProps {
  token: string;
  crewId: number;
  crewName: string;
  astronautId: number;
  username: string;
  onClose: () => void;
  onSessionExpired: () => void;
}

// Shared styles for the buttons and inputs on this panel.
const buttonClass =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink-soft hover:bg-panel/10 border border-white/10 text-xs font-medium text-slate-200 transition-colors cursor-pointer disabled:opacity-60';
const inputClass =
  'w-24 px-2 py-1 text-sm text-slate-200 bg-panel border border-white/15 rounded-md focus:outline-none focus:border-brand';

// "heart_rate" -> "Heart rate".
function humanize(id: string) {
  const words = id.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// "[60, 100]" -> "60–100".
function rangeText([low, high]: [number, number]) {
  return `${low}–${high}`;
}

// The message to show for an error: the server's text when there is one, otherwise the fallback.
function errorText(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

// Superadmin: set a crew member's own normal and caution ranges, value by value.
// Values that are not changed keep the defaults from rules.json.
export function PersonalRangesPanel({
  token,
  crewId,
  crewName,
  astronautId,
  username,
  onClose,
  onSessionExpired,
}: PersonalRangesPanelProps) {
  const [rows, setRows] = useState<PersonalRangeRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await superadminApi.listPersonalRanges(token, crewId, astronautId));
      setLoadError(null);
    } catch (err) {
      if (isUnauthorized(err)) onSessionExpired();
      else setLoadError(errorText(err, 'Could not load the ranges.'));
    }
  }, [token, crewId, astronautId, onSessionExpired]);

  useEffect(() => {
    void load();
  }, [load]);

  // The values grouped by indicator, in the order of rules.json.
  const groups = useMemo(() => {
    const byIndicator = new Map<string, PersonalRangeRow[]>();
    for (const row of rows ?? []) {
      byIndicator.set(row.indicatorId, [...(byIndicator.get(row.indicatorId) ?? []), row]);
    }
    return [...byIndicator.entries()];
  }, [rows]);

  return (
    <div className="starfield min-h-screen text-slate-200 flex flex-col">
      <header className="bg-night/80 backdrop-blur border-b border-white/10 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-bold text-sm sm:text-base tracking-tight">Personal ranges: {username}</h1>
            <p className="text-xs text-slate-400">{crewName}</p>
          </div>
          <button type="button" onClick={onClose} className={buttonClass}>
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to crew
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <p className="text-sm text-slate-300">
          Set a normal and a caution range for this crew member. Values inside the normal range are normal, values
          inside the caution range are caution, and anything outside is urgent. Ranges must stay inside the allowed
          limits, and the normal range must lie inside the caution range. Values you do not change keep the default.
        </p>

        {loadError && <p className="text-sm text-red-300">{loadError}</p>}
        {rows === null && !loadError && <p className="text-sm text-slate-400">Loading…</p>}

        {groups.map(([indicatorId, values]) => (
          <section key={indicatorId} className="rounded-2xl border border-white/10 bg-panel p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-200">{humanize(indicatorId)}</h2>
            <ul className="space-y-4">
              {values.map((row) => (
                <RangeRow
                  // Remounts with fresh inputs whenever the saved ranges change.
                  key={`${row.indicatorId}.${row.valueKey}.${row.normal.join()}.${row.caution.join()}`}
                  row={row}
                  token={token}
                  crewId={crewId}
                  astronautId={astronautId}
                  onChanged={load}
                  onSessionExpired={onSessionExpired}
                />
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}

// Props of one value's row: its current ranges and what to do after a change.
interface RangeRowProps {
  row: PersonalRangeRow;
  token: string;
  crewId: number;
  astronautId: number;
  onChanged: () => Promise<void>;
  onSessionExpired: () => void;
}

// One value (e.g. bpm) with four boxes for its normal and caution ranges.
function RangeRow({ row, token, crewId, astronautId, onChanged, onSessionExpired }: RangeRowProps) {
  const [normalLow, setNormalLow] = useState(String(row.normal[0]));
  const [normalHigh, setNormalHigh] = useState(String(row.normal[1]));
  const [cautionLow, setCautionLow] = useState(String(row.caution[0]));
  const [cautionHigh, setCautionHigh] = useState(String(row.caution[1]));
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const label = `${humanize(row.indicatorId)} ${row.valueKey}`;

  // Save this value's ranges. The server checks the limits and the order of the ranges.
  const save = async () => {
    const boxes = [normalLow, normalHigh, cautionLow, cautionHigh];
    const numbers = boxes.map((box) => Number(box));
    if (boxes.some((box) => box.trim() === '') || !numbers.every(Number.isFinite)) {
      setMessage('Enter a number in all four boxes.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await superadminApi.setPersonalRange(
        token,
        crewId,
        astronautId,
        row.indicatorId,
        row.valueKey,
        [numbers[0], numbers[1]],
        [numbers[2], numbers[3]],
      );
      await onChanged();
    } catch (err) {
      if (isUnauthorized(err)) onSessionExpired();
      else setMessage(errorText(err, 'Could not save the range.'));
    } finally {
      setBusy(false);
    }
  };

  // Go back to the default ranges for this value.
  const reset = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await superadminApi.resetPersonalRange(token, crewId, astronautId, row.indicatorId, row.valueKey);
      await onChanged();
    } catch (err) {
      if (isUnauthorized(err)) onSessionExpired();
      else setMessage(errorText(err, 'Could not restore the default.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="space-y-2 border-t border-white/5 pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm text-slate-200">{row.valueKey}</span>
        <span className="text-[11px] text-slate-400">Allowed {rangeText(row.limits)}</span>
        <span className="text-[11px] text-slate-400">
          Default normal {rangeText(row.defaultNormal)} · caution {rangeText(row.defaultCaution)}
        </span>
        {row.isPersonal && (
          <span className="rounded-md bg-brand/20 px-2 py-0.5 text-[11px] text-brand-light">Personal</span>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <fieldset className="flex flex-wrap items-end gap-2">
          <legend className="sr-only">{label} ranges</legend>
          <label className="flex flex-col gap-1 text-[11px] text-slate-400">
            Normal from
            <input type="number" step="any" className={inputClass} aria-label={`${label} normal from`} value={normalLow} onChange={(e) => setNormalLow(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-slate-400">
            Normal to
            <input type="number" step="any" className={inputClass} aria-label={`${label} normal to`} value={normalHigh} onChange={(e) => setNormalHigh(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-slate-400">
            Caution from
            <input type="number" step="any" className={inputClass} aria-label={`${label} caution from`} value={cautionLow} onChange={(e) => setCautionLow(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-slate-400">
            Caution to
            <input type="number" step="any" className={inputClass} aria-label={`${label} caution to`} value={cautionHigh} onChange={(e) => setCautionHigh(e.target.value)} />
          </label>
        </fieldset>
        <button type="button" disabled={busy} onClick={save} className={buttonClass}>
          <Save className="w-3.5 h-3.5" />
          Save {row.valueKey}
        </button>
        {row.isPersonal && (
          <button type="button" disabled={busy} onClick={reset} className={buttonClass}>
            <RotateCcw className="w-3.5 h-3.5" />
            Use default
          </button>
        )}
      </div>
      {message && <p className="text-xs text-red-300">{message}</p>}
    </li>
  );
}

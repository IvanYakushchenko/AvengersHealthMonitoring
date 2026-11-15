// Code was assisted with Claude Code.
import type { AlertStatus, IndicationItem } from '../data/indicationGroups';
import { STATUS_BADGE, STATUS_LABEL } from '../data/statusStyles';

// Colours for the gauge arcs. Red only for 'critical'. Same meaning as the status badges.
const ARC_COLOR: Record<AlertStatus, string> = {
  nominal: '#34d399',
  warning: '#fcd34d',
  critical: '#c62828',
  unknown: '#475569',
};

// The top of each scale, for drawing the arcs. These are display scales, not limits:
// the real limits and ranges live in the backend rules.
const CO2_SCALE_MAX = 5000; // ppm
const RADIATION_SCALE_MAX = 600; // mSv (the mission limit on the cards)

// How much of the arc to fill (0 to 1). Missing or non-numeric values draw an empty arc.
export function gaugeFraction(value: number | null, max: number): number {
  if (value === null || !Number.isFinite(value) || max <= 0) return 0;
  return Math.min(Math.max(value / max, 0), 1);
}

// The number at the start of a value text, e.g. "482 ppm" -> 482, "161.8 mSv" -> 161.8.
function numberIn(text: string): number | null {
  const match = text.match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

interface GaugeProps {
  label: string;
  valueText: string;
  fraction: number;
  status: AlertStatus;
  cx: number;
}

// One round instrument: a dim track and a coloured arc for the reading.
function Gauge({ label, valueText, fraction, status, cx }: GaugeProps) {
  const r = 44;
  const cy = 112;
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#ffffff"
        strokeOpacity={0.08}
        strokeWidth={8}
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray="75 100"
        transform={`rotate(135 ${cx} ${cy})`}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={ARC_COLOR[status]}
        strokeOpacity={0.85}
        strokeWidth={8}
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray={`${fraction * 75} 100`}
        transform={`rotate(135 ${cx} ${cy})`}
      />
      <text x={cx} y={cy + 4} textAnchor="middle" className="fill-slate-200" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 15 }}>
        {numberIn(valueText) ?? '—'}
      </text>
      <text x={cx} y={cy + 66} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 11 }}>
        {label}
      </text>
    </g>
  );
}

interface HabitatViewProps {
  items: IndicationItem[];
}

// The habitat (cabin) instead of the human body, shown when the Habitat panel filter is selected.
// It draws the cabin air (CO₂) and the radiation dosimeter as two gauges, with their status.
export function HabitatView({ items }: HabitatViewProps) {
  const co2 = items.find((i) => i.id === 'cabin-co2');
  const radiation = items.find((i) => i.id === 'radiation-dose');

  const readings = [
    { item: co2, label: 'Cabin CO₂', max: CO2_SCALE_MAX },
    { item: radiation, label: 'Radiation dose', max: RADIATION_SCALE_MAX },
  ];

  return (
    <div className="flex h-full flex-col">
      <svg viewBox="0 0 300 236" role="img" aria-label="Cabin schematic with CO₂ and radiation gauges" className="w-full">
        {/* Cabin outline */}
        <rect x={6} y={6} width={288} height={224} rx={30} fill="none" stroke="#ffffff" strokeOpacity={0.14} strokeWidth={1.5} />
        {/* Window line along the top of the cabin */}
        <line x1={48} y1={44} x2={252} y2={44} stroke="#ffffff" strokeOpacity={0.08} strokeWidth={1} />
        <text x={150} y={34} textAnchor="middle" className="fill-slate-500" style={{ fontSize: 10, letterSpacing: 2 }}>
          HABITAT PANEL
        </text>
        {readings.map(({ item, label, max }, index) => {
          const cx = index === 0 ? 86 : 214;
          const status = item?.status ?? 'unknown';
          const value = item?.currentValue ?? '—';
          return (
            <Gauge
              key={label}
              label={label}
              valueText={value}
              fraction={gaugeFraction(item ? numberIn(item.currentValue) : null, max)}
              status={status}
              cx={cx}
            />
          );
        })}
      </svg>

      {/* The readings as text, for everyone (including screen readers) */}
      <div className="mt-3 space-y-2">
        {readings.map(({ item, label }) => (
          <div key={label} className="flex items-start justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-300">{label}</p>
              <p className="mt-0.5 font-mono text-sm text-slate-200">{item?.currentValue ?? '—'}</p>
              {item?.message && <p className="mt-1 text-[11px] text-slate-400">{item.message}</p>}
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_BADGE[item?.status ?? 'unknown']}`}>
              {STATUS_LABEL[item?.status ?? 'unknown']}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

import type { BackendStatus } from '../../../api/healthApi';
import type { AlertStatus } from './indicationGroups';

// One number the user types in. The key matches the backend's `values` object.
// Its allowed range and whether it is optional come from GET /api/indicators.
export interface FieldSpec {
  key: string;
  label: string;
}

// Links one card on the page to one backend indicator.
export interface IndicatorBinding {
  itemId: string; // id in INITIAL_INDICATION_GROUPS
  indicatorId: string; // id in the backend (see README, "Indicators")
  fields: FieldSpec[];
  // Turns a reading's values into the text shown on the card.
  format: (v: Record<string, number>) => string;
}

export const INDICATOR_BINDINGS: IndicatorBinding[] = [
  {
    itemId: 'resting-hr',
    indicatorId: 'heart_rate',
    fields: [{ key: 'bpm', label: 'Heart rate (bpm)' }],
    format: (v) => `${v.bpm} bpm`,
  },
  {
    itemId: 'blood-pressure',
    indicatorId: 'blood_pressure',
    fields: [
      { key: 'systolic', label: 'Systolic (mmHg)' },
      { key: 'diastolic', label: 'Diastolic (mmHg)' },
    ],
    format: (v) => `${v.systolic}/${v.diastolic} mmHg`,
  },
  {
    itemId: 'spo2',
    indicatorId: 'spo2',
    fields: [
      { key: 'percent', label: 'SpO₂ (%)' },
      { key: 'breathsPerMinute', label: 'Breaths per minute' },
    ],
    format: (v) =>
      v.breathsPerMinute === undefined
        ? `${v.percent}%`
        : `${v.percent}% · ${v.breathsPerMinute} br/min`,
  },
  {
    itemId: 'body-temp',
    indicatorId: 'temperature',
    fields: [{ key: 'celsius', label: 'Temperature (°C)' }],
    format: (v) => `${v.celsius.toFixed(1)} °C`,
  },
  {
    itemId: 'sleep',
    indicatorId: 'sleep',
    fields: [
      { key: 'hours', label: 'Hours slept' },
      { key: 'quality', label: 'Quality' },
    ],
    format: (v) => `${v.hours} h · quality ${v.quality}/5`,
  },
  {
    itemId: 'mood-stress',
    indicatorId: 'mood_stress',
    fields: [
      { key: 'mood', label: 'Mood' },
      { key: 'stress', label: 'Stress' },
      { key: 'isolation', label: 'Isolation' },
    ],
    format: (v) => `Mood ${v.mood} · Stress ${v.stress} · Isolation ${v.isolation}`,
  },
  {
    itemId: 'vision-check',
    indicatorId: 'vision',
    fields: [
      { key: 'newBlur', label: 'New blur (0 = no, 1 = yes)' },
      { key: 'clarity', label: 'Clarity' },
    ],
    format: (v) => `${v.newBlur ? 'Blur reported' : 'No blur'} · clarity ${v.clarity}/5`,
  },
  {
    itemId: 'exercise',
    indicatorId: 'exercise',
    fields: [
      { key: 'minutes', label: 'Minutes' },
      { key: 'effort', label: 'Effort' },
    ],
    format: (v) => `${v.minutes} min · effort ${v.effort}/5`,
  },
  {
    itemId: 'cabin-co2',
    indicatorId: 'cabin_co2',
    fields: [{ key: 'ppm', label: 'CO₂ (ppm)' }],
    format: (v) => `${v.ppm} ppm`,
  },
  {
    itemId: 'radiation-dose',
    indicatorId: 'radiation',
    fields: [{ key: 'totalMsv', label: 'Dosimeter total (mSv)' }],
    format: (v) => `${v.totalMsv} mSv`,
  },
];

export const BINDING_BY_ITEM_ID: Record<string, IndicatorBinding> = Object.fromEntries(
  INDICATOR_BINDINGS.map((b) => [b.itemId, b]),
);

export const BACKEND_INDICATOR_IDS: string[] = INDICATOR_BINDINGS.map((b) => b.indicatorId);

// Backend ratings use normal/caution/urgent. The UI uses nominal/warning/critical.
export function toAlertStatus(status: BackendStatus | undefined): AlertStatus {
  switch (status) {
    case 'normal':
      return 'nominal';
    case 'caution':
      return 'warning';
    case 'urgent':
      return 'critical';
    default:
      return 'unknown';
  }
}

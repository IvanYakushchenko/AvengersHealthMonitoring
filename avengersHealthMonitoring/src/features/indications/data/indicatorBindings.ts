import type { BackendStatus } from '../api/healthApi';
import type { AlertStatus } from './indicationGroups';

// One number the user types in. The key matches the backend's `values` object.
export interface FieldSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  optional?: boolean;
}

// Links one card on the page to one backend indicator.
export interface IndicatorBinding {
  itemId: string; // id in INITIAL_INDICATION_GROUPS
  indicatorId: string; // id in the backend (see README, "Indicators")
  fields: FieldSpec[];
  // Turns the newest reading's values into the text shown on the card.
  format: (v: Record<string, number>) => string;
}

// Limits match the backend's rules.json "limits", so typos are caught before sending.
export const INDICATOR_BINDINGS: IndicatorBinding[] = [
  {
    itemId: 'resting-hr',
    indicatorId: 'heart_rate',
    fields: [{ key: 'bpm', label: 'Heart rate (bpm)', min: 20, max: 250, step: 1 }],
    format: (v) => `${v.bpm} bpm`,
  },
  {
    itemId: 'blood-pressure',
    indicatorId: 'blood_pressure',
    fields: [
      { key: 'systolic', label: 'Systolic (mmHg)', min: 50, max: 260, step: 1 },
      { key: 'diastolic', label: 'Diastolic (mmHg)', min: 30, max: 160, step: 1 },
    ],
    format: (v) => `${v.systolic}/${v.diastolic} mmHg`,
  },
  {
    itemId: 'spo2',
    indicatorId: 'spo2',
    fields: [
      { key: 'percent', label: 'SpO₂ (%)', min: 50, max: 100, step: 1 },
      { key: 'breathsPerMinute', label: 'Breaths per minute', min: 1, max: 80, step: 1, optional: true },
    ],
    format: (v) =>
      v.breathsPerMinute === undefined
        ? `${v.percent}%`
        : `${v.percent}% · ${v.breathsPerMinute} br/min`,
  },
  {
    itemId: 'body-temp',
    indicatorId: 'temperature',
    fields: [{ key: 'celsius', label: 'Temperature (°C)', min: 30, max: 45, step: 0.1 }],
    format: (v) => `${v.celsius.toFixed(1)} °C`,
  },
  {
    itemId: 'sleep',
    indicatorId: 'sleep',
    fields: [
      { key: 'hours', label: 'Hours slept', min: 0, max: 24, step: 0.1 },
      { key: 'quality', label: 'Quality (1–5)', min: 1, max: 5, step: 1 },
    ],
    format: (v) => `${v.hours} h · quality ${v.quality}/5`,
  },
  {
    itemId: 'mood-stress',
    indicatorId: 'mood_stress',
    fields: [
      { key: 'mood', label: 'Mood (1–5)', min: 1, max: 5, step: 1 },
      { key: 'stress', label: 'Stress (1–5)', min: 1, max: 5, step: 1 },
      { key: 'isolation', label: 'Isolation (1–5)', min: 1, max: 5, step: 1 },
    ],
    format: (v) => `Mood ${v.mood} · Stress ${v.stress} · Isolation ${v.isolation}`,
  },
  {
    itemId: 'vision-check',
    indicatorId: 'vision',
    fields: [
      { key: 'newBlur', label: 'New blur (0 = no, 1 = yes)', min: 0, max: 1, step: 1 },
      { key: 'clarity', label: 'Clarity (1–5)', min: 1, max: 5, step: 1 },
    ],
    format: (v) => `${v.newBlur ? 'Blur reported' : 'No blur'} · clarity ${v.clarity}/5`,
  },
  {
    itemId: 'exercise',
    indicatorId: 'exercise',
    fields: [
      { key: 'minutes', label: 'Minutes', min: 0, max: 600, step: 1 },
      { key: 'effort', label: 'Effort (1–5)', min: 1, max: 5, step: 1 },
    ],
    format: (v) => `${v.minutes} min · effort ${v.effort}/5`,
  },
  {
    itemId: 'cabin-co2',
    indicatorId: 'cabin_co2',
    fields: [{ key: 'ppm', label: 'CO₂ (ppm)', min: 0, max: 50000, step: 1 }],
    format: (v) => `${v.ppm} ppm`,
  },
  {
    itemId: 'radiation-dose',
    indicatorId: 'radiation',
    fields: [{ key: 'totalMsv', label: 'Dosimeter total (mSv)', min: 0, max: 5000, step: 0.1 }],
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

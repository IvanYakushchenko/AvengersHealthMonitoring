// Code was assisted with Claude.
// The body regions the indicators belong to. The names match the 3D model and the region buttons.
export type BodyRegion =
  | 'Heart'
  | 'Lungs'
  | 'Whole body'
  | 'Head'
  | 'Legs and spine'
  | 'Eyes'
  | 'Habitat panel';

// 'unknown' = no reading yet (or the backend is not reachable). It never looks like a problem.
export type AlertStatus = 'nominal' | 'warning' | 'critical' | 'unknown';

// One indicator card on the page. Some fields are static text (name, hazard, baseline); the value and status come from the backend.
export interface IndicationItem {
  id: string;
  name: string;
  region: BodyRegion;
  hazard: string;
  alertLogic: string;
  baseline: string;
  // Filled in from the backend. '—' until a reading exists.
  currentValue: string;
  status: AlertStatus;
  // The backend's short explanation of the latest rating.
  message?: string;
  privateSurgeonFlag?: boolean;
}

// A titled group of cards on the page (for example Cardiopulmonary & Vitals).
export interface IndicationGroup {
  id: string;
  title: string;
  subtitle: string;
  items: IndicationItem[];
}

// Worst status of a set of items. 'unknown' only when no item has a rating.
export function aggregateStatus(items: Pick<IndicationItem, 'status'>[]): AlertStatus {
  if (items.some((i) => i.status === 'critical')) return 'critical';
  if (items.some((i) => i.status === 'warning')) return 'warning';
  if (items.some((i) => i.status === 'nominal')) return 'nominal';
  return 'unknown';
}

// Static card content. Values and statuses are filled in from the backend.
export const INITIAL_INDICATION_GROUPS: IndicationGroup[] = [
  {
    id: 'cardiopulmonary',
    title: 'Cardiopulmonary & Vitals',
    subtitle: 'Gravity adaptation & closed-loop oxygenation',
    items: [
      {
        id: 'resting-hr',
        name: 'Resting heart rate',
        region: 'Heart',
        hazard: 'Gravity: cardiovascular adaptation',
        alertLogic: 'Range',
        baseline: '62 bpm',
        currentValue: '—',
        status: 'unknown',
      },
      {
        id: 'blood-pressure',
        name: 'Blood pressure',
        region: 'Heart',
        hazard: 'Gravity: cardiovascular adaptation',
        alertLogic: 'Range',
        baseline: '118/76',
        currentValue: '—',
        status: 'unknown',
      },
      {
        id: 'spo2',
        name: 'Blood oxygen (SpO₂)',
        region: 'Lungs',
        hazard: 'Closed environments: hypoxia',
        alertLogic: 'Range',
        baseline: '98%',
        currentValue: '—',
        status: 'unknown',
      },
      {
        id: 'body-temp',
        name: 'Body temperature',
        region: 'Whole body',
        hazard: 'Closed environments: immune changes, infection',
        alertLogic: 'Range',
        baseline: '36.6 °C',
        currentValue: '—',
        status: 'unknown',
      },
    ],
  },
  {
    id: 'neuro-behavioral',
    title: 'Neuro-Ocular & Behavioral Health',
    subtitle: 'SANS monitoring & isolation resilience',
    items: [
      {
        id: 'sleep',
        name: 'Sleep',
        region: 'Head',
        hazard: 'Isolation: sleep loss, irregular schedules',
        alertLogic: 'Hours and quality rating',
        baseline: '7.5 hrs (Q4)',
        currentValue: '—',
        status: 'unknown',
      },
      {
        id: 'mood-stress',
        name: 'Mood and stress',
        region: 'Head',
        hazard: 'Isolation: behavioral health',
        alertLogic: 'Mood, stress and isolation scores. Very low mood triggers a private flag to the flight surgeon',
        baseline: '1–5 scale',
        currentValue: '—',
        status: 'unknown',
      },
      {
        id: 'vision-check',
        name: 'Vision check',
        region: 'Eyes',
        hazard: 'Gravity: neuro-ocular changes (SANS)',
        alertLogic: 'Any new blur or reduced clarity',
        baseline: 'No blur',
        currentValue: '—',
        status: 'unknown',
      },
    ],
  },
  {
    id: 'musculoskeletal-habitat',
    title: 'Musculoskeletal & Habitat Environment',
    subtitle: 'Countermeasures & spacecraft telemetry',
    items: [
      {
        id: 'exercise',
        name: 'Exercise',
        region: 'Legs and spine',
        hazard: 'Gravity: bone, muscle and fitness loss',
        alertLogic: 'Daily target and effort',
        baseline: '90 min/day',
        currentValue: '—',
        status: 'unknown',
      },
      {
        id: 'cabin-co2',
        name: 'Cabin CO₂',
        region: 'Habitat panel',
        hazard: 'Closed environments',
        alertLogic: 'Range',
        baseline: '≤ 2600 ppm',
        currentValue: '—',
        status: 'unknown',
      },
      {
        id: 'radiation-dose',
        name: 'Radiation dose',
        region: 'Habitat panel',
        hazard: 'Space radiation',
        alertLogic: 'Cumulative dose vs mission limit',
        baseline: 'Limit: 600 mSv',
        currentValue: '—',
        status: 'unknown',
      },
    ],
  },
];

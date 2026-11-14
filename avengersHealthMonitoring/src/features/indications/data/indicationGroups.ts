export type BodyRegion =
  | 'Heart'
  | 'Lungs'
  | 'Whole body'
  | 'Head'
  | 'Legs and spine'
  | 'Eyes'
  | 'Habitat panel';

export type AlertStatus = 'nominal' | 'warning' | 'critical';

export interface IndicationItem {
  id: string;
  name: string;
  region: BodyRegion;
  inputType: 'number' | 'bp' | 'spo2' | 'sleep' | 'mood' | 'exercise' | 'vision';
  inputLabel: string;
  hazard: string;
  alertLogic: string;
  unit: string;
  baseline: string;
  currentValue: string;
  status: AlertStatus;
  privateSurgeonFlag?: boolean;
  trendNote?: string;
}

export interface IndicationGroup {
  id: string;
  title: string;
  subtitle: string;
  items: IndicationItem[];
}

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
        inputType: 'number',
        inputLabel: 'BPM (One number)',
        hazard: 'Gravity: cardiovascular adaptation',
        alertLogic: 'Range, plus change from own baseline',
        unit: 'bpm',
        baseline: '62 bpm',
        currentValue: '66',
        status: 'nominal',
        trendNote: '+4 bpm vs baseline',
      },
      {
        id: 'blood-pressure',
        name: 'Blood pressure',
        region: 'Heart',
        inputType: 'bp',
        inputLabel: 'Systolic / Diastolic',
        hazard: 'Gravity: cardiovascular adaptation',
        alertLogic: 'Range and trend',
        unit: 'mmHg',
        baseline: '118/76',
        currentValue: '122/79',
        status: 'nominal',
        trendNote: 'Stable 7-day trend',
      },
      {
        id: 'spo2',
        name: 'Blood oxygen (SpO₂)',
        region: 'Lungs',
        inputType: 'spo2',
        inputLabel: 'SpO₂ % (breathing rate optional)',
        hazard: 'Closed environments: hypoxia',
        alertLogic: 'Range',
        unit: '%',
        baseline: '98%',
        currentValue: '97',
        status: 'nominal',
        trendNote: '14 br/min',
      },
      {
        id: 'body-temp',
        name: 'Body temperature',
        region: 'Whole body',
        inputType: 'number',
        inputLabel: 'Temp °C (One number)',
        hazard: 'Closed environments: immune changes, infection',
        alertLogic: 'Range and 3-day trend',
        unit: '°C',
        baseline: '36.6 °C',
        currentValue: '37.3',
        status: 'warning',
        trendNote: '+0.7°C over 3 days',
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
        inputType: 'sleep',
        inputLabel: 'Hours & 1–5 quality rating',
        hazard: 'Isolation: sleep loss, irregular schedules',
        alertLogic: 'Hours below target on repeated nights',
        unit: 'hrs',
        baseline: '7.5 hrs (Q4)',
        currentValue: '5.5 hrs • Q3',
        status: 'warning',
        trendNote: '2nd night below 6.5h target',
      },
      {
        id: 'mood-stress',
        name: 'Mood and stress',
        region: 'Head',
        inputType: 'mood',
        inputLabel: '3–5 quick questions score',
        hazard: 'Isolation: behavioral health',
        alertLogic: 'Score, plus persistent decline triggers a private flag to the flight surgeon',
        unit: 'pts',
        baseline: '18/20',
        currentValue: '12/20',
        status: 'critical',
        privateSurgeonFlag: true,
        trendNote: 'Persistent decline (4 days)',
      },
      {
        id: 'vision-check',
        name: 'Vision check',
        region: 'Eyes',
        inputType: 'vision',
        inputLabel: 'Symptoms & near-vision test',
        hazard: 'Gravity: neuro-ocular changes (SANS)',
        alertLogic: 'Any new blur or decline vs own baseline',
        unit: 'acuity',
        baseline: '20/20 (No blur)',
        currentValue: '20/20 • Clear',
        status: 'nominal',
        trendNote: 'Amsler grid normal',
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
        inputType: 'exercise',
        inputLabel: 'Minutes & effort level (RPE)',
        hazard: 'Gravity: bone, muscle and fitness loss',
        alertLogic: 'Daily target and streak',
        unit: 'min',
        baseline: '90 min/day',
        currentValue: '95 min • RPE 7',
        status: 'nominal',
        trendNote: '14-day streak active',
      },
      {
        id: 'cabin-co2',
        name: 'Cabin CO₂',
        region: 'Habitat panel',
        inputType: 'number',
        inputLabel: 'ppCO₂ (One number)',
        hazard: 'Closed environments',
        alertLogic: 'Range',
        unit: 'mmHg',
        baseline: '< 3.0 mmHg',
        currentValue: '2.4',
        status: 'nominal',
        trendNote: 'Scrubbers nominal',
      },
      {
        id: 'radiation-dose',
        name: 'Radiation dose',
        region: 'Habitat panel',
        inputType: 'number',
        inputLabel: 'Dosimeter reading',
        hazard: 'Space radiation',
        alertLogic: 'Cumulative dose vs mission limit',
        unit: 'mSv',
        baseline: 'Limit: 600 mSv',
        currentValue: '142.8',
        status: 'nominal',
        trendNote: '23.8% of career/mission limit',
      },
    ],
  },
];
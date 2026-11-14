export type Indication = {
  id: string
  name: string
  description: string
}

export type IndicationGroup = {
  id: string
  title: string
  indications: Indication[]
}

// Placeholder content: replace with the real medical indications.
export const indicationGroups: IndicationGroup[] = [
  {
    id: 'cardiovascular',
    title: 'Cardiovascular',
    indications: [
      { id: 'heart-rate', name: 'Heart rate', description: 'Monitor resting and exercise heart rate.' },
      { id: 'blood-pressure', name: 'Blood pressure', description: 'Track systolic and diastolic pressure.' },
    ],
  },
  {
    id: 'respiratory',
    title: 'Respiratory',
    indications: [
      { id: 'spo2', name: 'Oxygen saturation', description: 'Measure SpO2 levels during missions.' },
    ],
  },
  {
    id: 'neurological',
    title: 'Neurological',
    indications: [
      { id: 'cognition', name: 'Cognitive function', description: 'Assess attention and memory performance.' },
    ],
  },
]

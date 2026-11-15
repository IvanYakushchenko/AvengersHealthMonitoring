// Code was assisted with Claude.

// What to do when an indicator needs attention. These are general steps for the crew.
// They do not replace the mission procedures or the flight surgeon: when a value is
// urgent, the first step is always to contact the flight surgeon.
// Ranges are not written here; the app reads them from the backend (rules.json).

export interface AttentionSteps {
  // Steps for a "caution" reading (shown as Trend Watch on the card).
  caution: string[]
  // Steps for an "urgent" reading (shown as Alert on the card).
  urgent: string[]
}

export const ATTENTION_GUIDE: Record<string, AttentionSteps> = {
  heart_rate: {
    caution: [
      'Stop any exercise and sit or lie down.',
      'Breathe slowly and rest for 10 minutes.',
      'Drink some water, then measure again.',
    ],
    urgent: [
      'Contact the flight surgeon now.',
      'Stop all activity and rest.',
      'Tell the flight surgeon about any chest pain, dizziness or shortness of breath.',
      'Measure again after 10 minutes of rest and report the value.',
    ],
  },
  blood_pressure: {
    caution: [
      'Sit upright and rest quietly for 5 minutes.',
      'Avoid caffeine and salty food for the next hour.',
      'Measure again with the cuff on a bare arm.',
    ],
    urgent: [
      'Contact the flight surgeon now.',
      'Stop activity and rest sitting upright.',
      'Tell the flight surgeon about any headache, chest pain, vision changes or dizziness.',
      'Measure again after 10 minutes and report the value.',
    ],
  },
  spo2: {
    caution: [
      'Sit upright and breathe slowly and deeply.',
      'Check the cabin air system and your oxygen supply.',
      'Rest for 10 minutes, then measure again.',
    ],
    urgent: [
      'Contact the flight surgeon now.',
      'Stop all activity and sit upright.',
      'Check the oxygen supply and use it as the procedures allow.',
      'Report any breathlessness, chest pain or confusion immediately.',
    ],
  },
  temperature: {
    caution: [
      'Drink some water and rest in a cool place.',
      'Remove extra clothing.',
      'Measure again in 30 minutes.',
    ],
    urgent: [
      'Contact the flight surgeon now.',
      'Stop activity and cool down.',
      'Drink water and rest.',
      'Report shivering, confusion, vomiting or a headache immediately.',
    ],
  },
  sleep: {
    caution: [
      'Keep your usual sleep schedule and protect your next sleep period.',
      'Dim the lights and avoid screens for 30 minutes before sleep.',
      'Tell the crew if your schedule has shifted.',
    ],
    urgent: [
      'Contact the flight surgeon about your poor sleep today.',
      'Do not take any sleep medication without medical approval.',
      'Plan a longer rest period as soon as the schedule allows.',
    ],
  },
  mood_stress: {
    caution: [
      'Take a short break and do one calming activity.',
      'Talk to a crewmate about how you feel.',
      'Use the planned support contacts if the feeling continues.',
    ],
    urgent: [
      'Contact the crew psychologist now.',
      'Tell a crewmate or the flight surgeon how you feel today.',
      'If you have thoughts of harming yourself or feel unsafe, tell someone immediately and follow the emergency procedure.',
    ],
  },
  exercise: {
    caution: [
      'Adjust your next session: go lighter if the effort was too high, or add a short session if you are below target.',
      'Warm up before exercising and cool down afterwards.',
    ],
    urgent: [
      'Contact the flight surgeon now, and stop exercise for today.',
      'Rest, drink water and check your heart rate.',
      'Contact the flight surgeon before the next session.',
    ],
  },
  vision: {
    caution: [
      'Rest your eyes and avoid close work for a while.',
      'Check your vision again in a few days.',
      'Note any changes in blur, double vision or clarity.',
    ],
    urgent: [
      'Contact the flight surgeon now.',
      'Report the new blur or loss of clarity immediately.',
      'Do not carry out tasks that need precise vision until the flight surgeon has checked you.',
    ],
  },
  cabin_co2: {
    caution: [
      'Check the CO₂ scrubber and the ventilation.',
      'Reduce your activity and open the air flow as the procedures allow.',
      'Check the CO₂ level again in 15 minutes and watch for headache.',
    ],
    urgent: [
      'Contact mission control now.',
      'Follow the CO₂ procedure: increase ventilation and switch to the backup scrubber if one is available.',
      'Use a mask as the procedures allow, and reduce activity.',
    ],
  },
  radiation: {
    caution: [
      'Check your dose with mission control.',
      'Plan your next activity with the dose in mind.',
    ],
    urgent: [
      'Contact mission control now.',
      'Follow the radiation dose limit procedure.',
      'Avoid any further planned exposure until mission control has confirmed the plan.',
    ],
  },
}

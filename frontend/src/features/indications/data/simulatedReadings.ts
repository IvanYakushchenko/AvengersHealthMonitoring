// Code was assisted with Claude.
import type { IndicatorInfo } from '../../../api/healthApi'

// Random values for the simulated sensors (auto mode). The ranges come from the backend's
// rules.json ("simulation" per value), so they are changed there, not here.

// Random number between min and max (inclusive). rng returns a number in [0, 1).
function between(min: number, max: number, whole: boolean, rng: () => number): number {
  if (whole) {
    const low = Math.ceil(min)
    const high = Math.floor(max)
    return low + Math.floor(rng() * (high - low + 1))
  }
  return Math.round((min + rng() * (max - min)) * 10) / 10
}

// One simulated set of values for one indicator, like a sensor would send.
// Returns {} when the backend's ranges are not known yet.
export function generateReadingValues(
  info: IndicatorInfo | undefined,
  rng: () => number = Math.random,
): Record<string, number> {
  const values: Record<string, number> = {}
  if (!info) return values
  for (const [key, rule] of Object.entries(info.values)) {
    const range = rule.simulation
    if (!range) continue
    if (rule.optional && rng() < 0.2) continue // some sensors skip optional values
    values[key] = between(range.min, range.max, range.whole === true || rule.wholeNumber, rng)
  }
  // Diastolic must stay below systolic.
  if (info.indicatorId === 'blood_pressure' && values.diastolic !== undefined && values.systolic !== undefined && values.diastolic >= values.systolic) {
    values.diastolic = values.systolic - 20
  }
  return values
}

// Code was assisted with Claude.
import { describe, expect, it } from 'vitest'
import { generateReadingValues } from './simulatedReadings'
import type { IndicatorInfo, ValueRule } from '../../../api/healthApi'

// A deterministic "random" source for repeatable tests.
function sequence(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const value = (limits: [number, number], simulation: ValueRule['simulation'], extra: Partial<ValueRule> = {}): ValueRule => ({
  limits,
  normal: limits,
  caution: limits,
  optional: false,
  wholeNumber: false,
  simulation,
  ...extra,
})

const temperature: IndicatorInfo = {
  indicatorId: 'temperature',
  region: 'body',
  dueEveryHours: 24,
  values: { celsius: value([30, 45], { min: 35, max: 40 }) },
}

const pressure: IndicatorInfo = {
  indicatorId: 'blood_pressure',
  region: 'heart',
  dueEveryHours: 24,
  values: {
    systolic: value([50, 260], { min: 95, max: 150, whole: true }),
    diastolic: value([30, 160], { min: 60, max: 95, whole: true }),
  },
}

describe('simulated readings', () => {
  it('temperature stays between 35 and 40 degrees', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { celsius } = generateReadingValues(temperature, sequence(seed))
      expect(celsius).toBeGreaterThanOrEqual(35)
      expect(celsius).toBeLessThanOrEqual(40)
    }
  })

  it('whole-number ranges give whole numbers inside the range', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { systolic, diastolic } = generateReadingValues(pressure, sequence(seed))
      expect(Number.isInteger(systolic)).toBe(true)
      expect(systolic).toBeGreaterThanOrEqual(95)
      expect(systolic).toBeLessThanOrEqual(150)
      expect(diastolic).toBeLessThan(systolic)
    }
  })

  it('a value without a simulation range is not generated', () => {
    const info: IndicatorInfo = { ...temperature, values: { celsius: value([30, 45], null) } }
    expect(generateReadingValues(info)).toEqual({})
  })

  it('no ranges loaded yet gives no values', () => {
    expect(generateReadingValues(undefined)).toEqual({})
  })
})

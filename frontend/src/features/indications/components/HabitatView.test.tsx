// Code was assisted with Claude Code.
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HabitatView, gaugeFraction } from './HabitatView'
import type { IndicationItem } from '../data/indicationGroups'

const item = (id: string, name: string, currentValue: string, status: IndicationItem['status']): IndicationItem => ({
  id,
  name,
  region: 'Habitat panel',
  hazard: '',
  alertLogic: '',
  baseline: '',
  currentValue,
  status,
  message: `${name} message`,
})

describe('gaugeFraction', () => {
  it('fills the arc in proportion and stays between 0 and 1', () => {
    expect(gaugeFraction(2500, 5000)).toBe(0.5)
    expect(gaugeFraction(9000, 5000)).toBe(1)
    expect(gaugeFraction(-5, 5000)).toBe(0)
    expect(gaugeFraction(null, 5000)).toBe(0)
  })
})

describe('HabitatView', () => {
  it('shows the CO₂ and radiation readings with their status', () => {
    render(
      <HabitatView
        items={[
          item('cabin-co2', 'Cabin CO₂', '482 ppm', 'nominal'),
          item('radiation-dose', 'Radiation dose', '161.8 mSv', 'warning'),
        ]}
      />,
    )
    expect(screen.getByText('482 ppm')).toBeInTheDocument()
    expect(screen.getByText('161.8 mSv')).toBeInTheDocument()
    expect(screen.getByText('Trend Watch')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Cabin schematic/ })).toBeInTheDocument()
  })

  it('shows a dash and "No data" before readings exist', () => {
    render(<HabitatView items={[]} />)
    // Two gauges and two text rows each show a dash.
    expect(screen.queryAllByText('—')).toHaveLength(4)
    expect(screen.queryAllByText('No data')).toHaveLength(2)
  })
})

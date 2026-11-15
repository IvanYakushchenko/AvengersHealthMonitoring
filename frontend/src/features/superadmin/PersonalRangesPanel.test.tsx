// Code was assisted with Claude.
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PersonalRangesPanel } from './PersonalRangesPanel'
import { superadminApi, type PersonalRangeRow } from '../../api/healthApi'

const bpm: PersonalRangeRow = {
  indicatorId: 'heart_rate',
  valueKey: 'bpm',
  limits: [20, 250],
  defaultNormal: [60, 100],
  defaultCaution: [50, 120],
  normal: [60, 100],
  caution: [50, 120],
  isPersonal: false,
}

function renderPanel() {
  return render(
    <PersonalRangesPanel
      token="t"
      crewId={1}
      crewName="Alpha"
      astronautId={7}
      username="demo_anna"
      onClose={vi.fn()}
      onSessionExpired={vi.fn()}
    />,
  )
}

describe('PersonalRangesPanel', () => {
  it('shows the default ranges of each value', async () => {
    vi.spyOn(superadminApi, 'listPersonalRanges').mockResolvedValue([bpm])
    renderPanel()
    expect(await screen.findByText('Default normal 60–100 · caution 50–120')).toBeInTheDocument()
    expect(screen.queryByText('Personal')).not.toBeInTheDocument()
  })

  it('saves a personal normal and caution range for one value', async () => {
    vi.spyOn(superadminApi, 'listPersonalRanges').mockResolvedValue([bpm])
    const setRange = vi.spyOn(superadminApi, 'setPersonalRange').mockResolvedValue({ message: 'ok' })
    renderPanel()
    await screen.findByText('Default normal 60–100 · caution 50–120')

    const normalTo = screen.getByLabelText('Heart rate bpm normal to')
    await userEvent.clear(normalTo)
    await userEvent.type(normalTo, '115')
    await userEvent.click(screen.getByRole('button', { name: 'Save bpm' }))

    await waitFor(() =>
      expect(setRange).toHaveBeenCalledWith('t', 1, 7, 'heart_rate', 'bpm', [60, 115], [50, 120]),
    )
  })

  it('does not save when a box is empty', async () => {
    vi.spyOn(superadminApi, 'listPersonalRanges').mockResolvedValue([bpm])
    const setRange = vi.spyOn(superadminApi, 'setPersonalRange').mockResolvedValue({ message: 'ok' })
    renderPanel()
    await screen.findByText('Default normal 60–100 · caution 50–120')

    await userEvent.clear(screen.getByLabelText('Heart rate bpm caution from'))
    await userEvent.click(screen.getByRole('button', { name: 'Save bpm' }))

    expect(await screen.findByText('Enter a number in all four boxes.')).toBeInTheDocument()
    expect(setRange).not.toHaveBeenCalled()
  })

  it('restores the default for a personal value', async () => {
    vi.spyOn(superadminApi, 'listPersonalRanges').mockResolvedValue([{ ...bpm, normal: [60, 115], isPersonal: true }])
    const reset = vi.spyOn(superadminApi, 'resetPersonalRange').mockResolvedValue({ message: 'ok' })
    renderPanel()

    expect(await screen.findByText('Personal')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Use default' }))

    await waitFor(() => expect(reset).toHaveBeenCalledWith('t', 1, 7, 'heart_rate', 'bpm'))
  })
})

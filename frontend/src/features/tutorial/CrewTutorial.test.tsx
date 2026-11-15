// Code was assisted with Claude.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CrewTutorial, TUTORIAL_STEPS } from './CrewTutorial'
import { hasSeenTutorial, markTutorialSeen } from './tutorialSeen'

describe('CrewTutorial', () => {
  it('goes through the steps with Next and Back', async () => {
    render(<CrewTutorial onClose={vi.fn()} />)
    expect(screen.getByText(TUTORIAL_STEPS[0].title)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText(TUTORIAL_STEPS[1].title)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText(TUTORIAL_STEPS[0].title)).toBeInTheDocument()
  })

  it('covers the main functions of the crew page', () => {
    const titles = TUTORIAL_STEPS.map((s) => s.title).join(' | ')
    expect(titles).toMatch(/indicators/i)
    expect(titles).toMatch(/Log a reading/i)
    expect(titles).toMatch(/Correct or delete/i)
    expect(titles).toMatch(/Body map/i)
    expect(titles).toMatch(/Streak/i)
    expect(titles).toMatch(/Account/i)
  })

  it('can be skipped at any step', async () => {
    const onClose = vi.fn()
    render(<CrewTutorial onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await userEvent.click(screen.getByRole('button', { name: 'Skip tutorial' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('finishes on the last step', async () => {
    const onClose = vi.fn()
    render(<CrewTutorial onClose={onClose} />)
    for (let i = 1; i < TUTORIAL_STEPS.length; i++) {
      await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    }
    await userEvent.click(screen.getByRole('button', { name: 'Finish' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('tutorial seen state', () => {
  beforeEach(() => window.localStorage.clear())

  it('remembers per user, ignoring case', () => {
    expect(hasSeenTutorial('crew_01')).toBe(false)
    markTutorialSeen('Crew_01')
    expect(hasSeenTutorial('crew_01')).toBe(true)
    expect(hasSeenTutorial('crew_02')).toBe(false)
  })
})

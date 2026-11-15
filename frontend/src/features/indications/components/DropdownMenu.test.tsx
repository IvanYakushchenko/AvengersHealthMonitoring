// Code was assisted with Claude.
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DropdownMenu } from './DropdownMenu'
import { STATUS_BADGE, STATUS_DOT } from '../data/statusStyles'

describe('DropdownMenu', () => {
  it('opens, runs the chosen item, and closes', async () => {
    const onSelect = vi.fn()
    render(<DropdownMenu ariaLabel="Account menu" trigger="Account" items={[{ label: 'Tutorial', onSelect }]} />)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Tutorial' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes with Escape', async () => {
    render(<DropdownMenu ariaLabel="Menu" trigger="Menu" items={[{ label: 'One', onSelect: vi.fn() }]} />)
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})

describe('status colours', () => {
  it('uses red only for the critical status', () => {
    for (const status of ['nominal', 'warning', 'unknown'] as const) {
      expect(STATUS_BADGE[status]).not.toMatch(/danger|red-/)
      expect(STATUS_DOT[status]).not.toMatch(/danger/)
    }
    expect(STATUS_BADGE.critical).toMatch(/danger/)
    expect(STATUS_DOT.critical).toMatch(/danger/)
  })
})

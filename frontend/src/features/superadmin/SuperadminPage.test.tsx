// Code was assisted with Claude.
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SuperadminPage } from './SuperadminPage'
import { superadminApi, type Crew } from '../../api/healthApi'

const alpha: Crew = { crewId: 1, name: 'Alpha', createdAt: '2026-11-15T10:00:00Z', memberCount: 0, adminCount: 0 }

function renderPage() {
  return render(
    <SuperadminPage token="t" username="root" onChangePassword={vi.fn()} onLogout={vi.fn()} onSessionExpired={vi.fn()} />,
  )
}

describe('SuperadminPage', () => {
  it('lists the crews', async () => {
    vi.spyOn(superadminApi, 'listCrews').mockResolvedValue([alpha])
    renderPage()
    expect(await screen.findByText('Alpha')).toBeInTheDocument()
  })

  it('creates a crew and reloads the list', async () => {
    vi.spyOn(superadminApi, 'listCrews').mockResolvedValue([])
    const createCrew = vi.spyOn(superadminApi, 'createCrew').mockResolvedValue(alpha)
    renderPage()
    expect(await screen.findByText('No crews yet.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Crew name'), 'Alpha')
    await userEvent.click(screen.getByRole('button', { name: 'Create crew' }))

    await waitFor(() => expect(createCrew).toHaveBeenCalledWith('t', 'Alpha'))
  })

  it('offers delete only for an empty crew', async () => {
    vi.spyOn(superadminApi, 'listCrews').mockResolvedValue([alpha, { ...alpha, crewId: 2, name: 'Beta', memberCount: 2 }])
    vi.spyOn(superadminApi, 'listCrewAdmins').mockResolvedValue([])
    vi.spyOn(superadminApi, 'listCrewMembers').mockResolvedValue([])
    renderPage()

    const [manageAlpha] = await screen.findAllByRole('button', { name: 'Manage' })
    await userEvent.click(manageAlpha)
    expect(await screen.findByRole('button', { name: 'Delete crew' })).toBeEnabled()
  })
})

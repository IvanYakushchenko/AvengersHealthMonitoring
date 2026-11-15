// Code was assisted with Claude.
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from './LoginPage'
import { ApiError, authApi } from '../../api/healthApi'

const session = {
  token: 't',
  astronautId: 1,
  username: 'crew_01',
  isAdmin: false,
  isSuperadmin: false,
  sex: 'female' as const,
  crewId: 1,
  crewName: 'Alpha',
}

describe('LoginPage', () => {
  it('logs in with the typed username and password', async () => {
    const login = vi.spyOn(authApi, 'login').mockResolvedValue(session)
    const onLogin = vi.fn()
    render(<LoginPage onLogin={onLogin} />)

    await userEvent.type(screen.getByLabelText('Username'), 'crew_01')
    await userEvent.type(screen.getByLabelText('Password'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    await waitFor(() => expect(onLogin).toHaveBeenCalledWith(session))
    expect(login).toHaveBeenCalledWith('crew_01', 'secret123')
  })

  it('asks for both fields before calling the server', async () => {
    const login = vi.spyOn(authApi, 'login')
    render(<LoginPage onLogin={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByText('Username is required.')).toBeInTheDocument()
    expect(screen.getByText('Password is required.')).toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
  })

  it('shows the server message, including the blocked-name text on two lines', async () => {
    vi.spyOn(authApi, 'login').mockRejectedValue(
      new ApiError('Fat Burgers are not allowed\nGlory to AUK Avengers', 400),
    )
    render(<LoginPage onLogin={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Username'), 'fat_burgers')
    await userEvent.type(screen.getByLabelText('Password'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByText(/Fat Burgers are not allowed/)).toHaveClass('whitespace-pre-line')
  })

  it('shows why the session ended', () => {
    render(<LoginPage onLogin={vi.fn()} notice="Your session has ended. Please log in again." />)
    expect(screen.getByText('Your session has ended. Please log in again.')).toBeInTheDocument()
  })
})

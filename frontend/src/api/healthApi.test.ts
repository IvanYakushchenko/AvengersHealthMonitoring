import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, authApi, isUnauthorized } from './healthApi'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('healthApi error messages', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows the server message for a plain error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(400, { detail: 'Fat Burgers are not allowed' })))
    await expect(authApi.login('fat_burgers', 'x')).rejects.toMatchObject({
      message: 'Fat Burgers are not allowed',
      status: 400,
    })
  })

  it('names the field for a validation error', async () => {
    const detail = [{ type: 'string_too_short', loc: ['body', 'password'], msg: 'String should have at least 1 character' }]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(422, { detail })))
    await expect(authApi.login('someone', '')).rejects.toThrow('password: String should have at least 1 character')
  })

  it('explains when the backend cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(authApi.login('someone', 'pw')).rejects.toThrow(/Cannot reach the backend/)
  })

  it('recognises an expired session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, { detail: 'Login expired' })))
    const error = await authApi.getIndicators().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(isUnauthorized(error)).toBe(true)
    expect(isUnauthorized(new Error('other'))).toBe(false)
  })
})

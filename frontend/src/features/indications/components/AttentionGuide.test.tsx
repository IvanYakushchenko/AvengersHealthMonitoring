// Code was assisted with Claude.
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AttentionGuide } from './AttentionGuide'
import { ATTENTION_GUIDE } from '../data/attentionGuide'
import { INDICATOR_BINDINGS } from '../data/indicatorBindings'
import type { IndicatorInfo } from '../../../api/healthApi'

const rules: Record<string, IndicatorInfo> = {
  temperature: {
    indicatorId: 'temperature',
    region: 'body',
    dueEveryHours: 24,
    values: {
      celsius: { limits: [30, 45], normal: [36.1, 37.5], caution: [35.5, 38.3], optional: false, wholeNumber: false },
    },
  },
}

describe('attention guide content', () => {
  it('has caution and urgent steps for every indicator on the page', () => {
    for (const binding of INDICATOR_BINDINGS) {
      const steps = ATTENTION_GUIDE[binding.indicatorId]
      expect(steps, binding.indicatorId).toBeDefined()
      expect(steps.caution.length, binding.indicatorId).toBeGreaterThan(0)
      expect(steps.urgent.length, binding.indicatorId).toBeGreaterThan(0)
    }
  })

  it('urgent steps always start with contacting the flight surgeon or mission control', () => {
    for (const [id, steps] of Object.entries(ATTENTION_GUIDE)) {
      expect(steps.urgent[0], id).toMatch(/flight surgeon|mission control|crew psychologist/)
    }
  })
})

describe('AttentionGuide', () => {
  it('shows the empty message when nothing needs attention', () => {
    render(<AttentionGuide items={[]} rules={rules} onClose={vi.fn()} />)
    expect(screen.getByText(/within the normal range/)).toBeInTheDocument()
  })

  it('shows caution steps and the normal range for a warning', () => {
    render(
      <AttentionGuide
        items={[{ indicatorId: 'temperature', name: 'Body temperature', status: 'warning', message: 'Slightly off.' }]}
        rules={rules}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('Body temperature')).toBeInTheDocument()
    expect(screen.getByText('Trend Watch')).toBeInTheDocument()
    expect(screen.getByText(/celsius 36.1–37.5/)).toBeInTheDocument()
    expect(screen.getByText(ATTENTION_GUIDE.temperature.caution[0])).toBeInTheDocument()
    expect(screen.queryByText(/contact the flight surgeon now for every alert/)).not.toBeInTheDocument()
  })

  it('shows the urgent banner and urgent steps for a critical reading', () => {
    render(
      <AttentionGuide
        items={[{ indicatorId: 'temperature', name: 'Body temperature', status: 'critical' }]}
        rules={rules}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('Alert')).toBeInTheDocument()
    expect(screen.getByText(/contact the flight surgeon now for every alert/)).toBeInTheDocument()
    expect(screen.getByText(ATTENTION_GUIDE.temperature.urgent[0])).toBeInTheDocument()
  })

  it('closes with the close button', async () => {
    const onClose = vi.fn()
    render(<AttentionGuide items={[]} rules={rules} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Close guide' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

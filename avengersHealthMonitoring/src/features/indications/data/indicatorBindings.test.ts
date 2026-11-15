import { describe, expect, it } from 'vitest'
import { BINDING_BY_ITEM_ID, INDICATOR_BINDINGS, toAlertStatus } from './indicatorBindings'
import { INITIAL_INDICATION_GROUPS, aggregateStatus } from './indicationGroups'

describe('card bindings', () => {
  it('has a binding for every card on the page', () => {
    const itemIds = INITIAL_INDICATION_GROUPS.flatMap((group) => group.items.map((item) => item.id))
    expect(itemIds.filter((id) => !BINDING_BY_ITEM_ID[id])).toEqual([])
    expect(INDICATOR_BINDINGS).toHaveLength(itemIds.length)
  })

  it('formats readings for the cards', () => {
    expect(BINDING_BY_ITEM_ID['blood-pressure'].format({ systolic: 122, diastolic: 79 })).toBe('122/79 mmHg')
    expect(BINDING_BY_ITEM_ID['spo2'].format({ percent: 97 })).toBe('97%')
    expect(BINDING_BY_ITEM_ID['spo2'].format({ percent: 97, breathsPerMinute: 14 })).toBe('97% · 14 br/min')
    expect(BINDING_BY_ITEM_ID['body-temp'].format({ celsius: 37.25 })).toBe('37.3 °C')
    expect(BINDING_BY_ITEM_ID['vision-check'].format({ newBlur: 1, clarity: 4 })).toBe('Blur reported · clarity 4/5')
  })
})

describe('status mapping', () => {
  it('maps backend ratings to card colours', () => {
    expect(toAlertStatus('normal')).toBe('nominal')
    expect(toAlertStatus('caution')).toBe('warning')
    expect(toAlertStatus('urgent')).toBe('critical')
    expect(toAlertStatus('unknown')).toBe('unknown')
    expect(toAlertStatus(undefined)).toBe('unknown')
  })

  it('region status is the worst item, and unknown only when nothing is rated', () => {
    expect(aggregateStatus([{ status: 'nominal' }, { status: 'warning' }])).toBe('warning')
    expect(aggregateStatus([{ status: 'unknown' }, { status: 'critical' }])).toBe('critical')
    expect(aggregateStatus([{ status: 'nominal' }, { status: 'unknown' }])).toBe('nominal')
    expect(aggregateStatus([{ status: 'unknown' }])).toBe('unknown')
    expect(aggregateStatus([])).toBe('unknown')
  })
})

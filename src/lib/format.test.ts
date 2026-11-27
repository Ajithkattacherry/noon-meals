import { describe, expect, it } from 'vitest'
import {
  formatDate,
  formatINR,
  formatQuantity,
  isISODate,
  roundMoney,
  todayISO,
} from './format'

describe('formatINR', () => {
  it('formats a whole amount with two decimals', () => {
    expect(formatINR(100)).toBe('₹100.00')
  })

  it('uses Indian digit grouping', () => {
    expect(formatINR(125000)).toBe('₹1,25,000.00')
  })

  it('rounds to paise', () => {
    expect(formatINR(3.655)).toBe('₹3.66')
  })
})

describe('formatDate', () => {
  it('formats an ISO date without timezone drift', () => {
    expect(formatDate('2026-11-26')).toBe('26-Nov-2026')
  })

  it('handles every month and single-digit days', () => {
    expect(formatDate('2026-01-05')).toBe('05-Jan-2026')
    expect(formatDate('2026-12-31')).toBe('31-Dec-2026')
  })

  it('returns the input when it is not an ISO date', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date')
  })
})

describe('formatQuantity', () => {
  it('shows whole items as integers', () => {
    expect(formatQuantity(10, 'Each')).toBe('10 Each')
  })

  it('trims trailing zeros for weights', () => {
    expect(formatQuantity(4, 'Kg')).toBe('4 Kg')
    expect(formatQuantity(0.25, 'Kg')).toBe('0.25 Kg')
    expect(formatQuantity(0.3333, 'Kg')).toBe('0.333 Kg')
  })
})

describe('roundMoney', () => {
  it('rounds half up at two decimals', () => {
    expect(roundMoney(0.125)).toBe(0.13)
    expect(roundMoney(3.654)).toBe(3.65)
    expect(roundMoney(245)).toBe(245)
  })
})

describe('date helpers', () => {
  it('builds today from local calendar parts', () => {
    expect(todayISO(new Date(2026, 10, 26, 23, 59))).toBe('2026-11-26')
  })

  it('validates calendar dates', () => {
    expect(isISODate('2026-11-26')).toBe(true)
    expect(isISODate('2026-02-30')).toBe(false)
    expect(isISODate('26-11-2026')).toBe(false)
  })
})

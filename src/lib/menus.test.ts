import { describe, expect, it } from 'vitest'
import { previousStudentCount } from './menus'

describe('previousStudentCount', () => {
  const menus = [
    { menuDate: '2026-11-24', studentCount: 60 },
    { menuDate: '2026-11-25', studentCount: 70 },
  ]

  it('returns the count from the latest menu before the date', () => {
    expect(previousStudentCount(menus, '2026-11-26')).toBe(70)
  })

  it('returns null before any menu exists', () => {
    expect(previousStudentCount(menus, '2026-11-20')).toBeNull()
  })

  it('ignores menus on or after the date', () => {
    expect(previousStudentCount(menus, '2026-11-25')).toBe(60)
  })

  it('returns null for an empty history', () => {
    expect(previousStudentCount([], '2026-11-26')).toBeNull()
  })
})

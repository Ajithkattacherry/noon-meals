import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Reports from './Reports'
import { listFinalizedMenus } from '../data/menus'
import type { DayCalculation } from '../lib/types'

vi.mock('../data/menus', () => ({
  listFinalizedMenus: vi.fn(),
}))

function snapshot(
  menuDate: string,
  studentCount: number,
  total: number,
  costPerChild: number | null,
): DayCalculation {
  return {
    menuDate,
    studentCount,
    bufferPercent: 0,
    recipes: [],
    flags: [],
    total,
    complete: true,
    costPerChild,
  }
}

const snapshots = [
  snapshot('2026-11-26', 100, 365, 3.65),
  snapshot('2026-11-29', 80, 300, 3.75),
  snapshot('2026-11-30', 90, 330, 3.67),
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listFinalizedMenus).mockResolvedValue(snapshots)
})

describe('Reports screen', () => {
  it('offers Day, Week, Month, Ingredient and Recipe tabs', async () => {
    render(<Reports />)

    for (const name of ['Day', 'Week', 'Month', 'Ingredient', 'Recipe']) {
      expect(await screen.findByRole('tab', { name })).toBeInTheDocument()
    }
  })

  it('shows the month total formatted in INR', async () => {
    const user = userEvent.setup()
    render(<Reports />)

    await screen.findByRole('tab', { name: 'Month' })
    await user.click(screen.getByRole('tab', { name: 'Month' }))

    expect(await screen.findByText('₹995.00')).toBeInTheDocument()
    expect(screen.getByText('Nov 2026')).toBeInTheDocument()
    expect(screen.getByText('₹3.69')).toBeInTheDocument()
    expect(screen.queryByText('995')).not.toBeInTheDocument()
  })

  it('shows an em dash when cost per child is unavailable', async () => {
    vi.mocked(listFinalizedMenus).mockResolvedValue([
      snapshot('2026-11-25', 0, 0, null),
    ])

    render(<Reports />)

    expect(await screen.findByText('—')).toBeInTheDocument()
  })
})

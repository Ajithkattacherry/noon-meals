import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BudgetPlanner from './BudgetPlanner'
import {
  getMonthlyBudget,
  saveFixedBill,
  saveMonthlyBudgetTarget,
  saveWeeklyAllocation,
} from '../data/budgets'
import { listIngredients } from '../data/ingredients'
import { listMenusInRange } from '../data/menus'
import { listPurchases } from '../data/purchases'
import { listRecipes } from '../data/recipes'

vi.mock('../data/budgets', () => ({
  getMonthlyBudget: vi.fn(),
  saveMonthlyBudgetTarget: vi.fn(),
  saveFixedBill: vi.fn(),
  deleteFixedBill: vi.fn(),
  saveWeeklyAllocation: vi.fn(),
}))
vi.mock('../data/ingredients', () => ({ listIngredients: vi.fn() }))
vi.mock('../data/menus', () => ({ listMenusInRange: vi.fn() }))
vi.mock('../data/purchases', () => ({ listPurchases: vi.fn() }))
vi.mock('../data/recipes', () => ({ listRecipes: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getMonthlyBudget).mockResolvedValue({
    budget: {
      id: 'b1',
      month: '2026-11',
      siteAmount: 49800,
      plannedTarget: 50000,
      notes: null,
    },
    fixedBills: [
      {
        id: 'f1',
        monthlyBudgetId: 'b1',
        label: 'Rice',
        billDate: '2026-11-02',
        amount: 12000,
        notes: null,
      },
    ],
    weeklyAllocations: [],
  })
  vi.mocked(listMenusInRange).mockResolvedValue([])
  vi.mocked(listRecipes).mockResolvedValue([])
  vi.mocked(listIngredients).mockResolvedValue([])
  vi.mocked(listPurchases).mockResolvedValue([])
  vi.mocked(saveMonthlyBudgetTarget).mockResolvedValue({
    id: 'b1',
    month: '2026-11',
    siteAmount: 49800,
    plannedTarget: 50000,
    notes: null,
  })
  vi.mocked(saveFixedBill).mockResolvedValue({
    id: 'f2',
    monthlyBudgetId: 'b1',
    label: 'Gas',
    billDate: '2026-11-05',
    amount: 3000,
    notes: null,
  })
  vi.mocked(saveWeeklyAllocation).mockResolvedValue({
    id: 'w1',
    monthlyBudgetId: 'b1',
    weekStart: '2026-11-02',
    groceryBill: 5000,
    vegetableBill: 4000,
    snacksBill: 0,
    notes: null,
  })
})

describe('BudgetPlanner screen', () => {
  it('shows planned target, fixed bills, and distributable balance', async () => {
    render(<BudgetPlanner />)

    expect(await screen.findByText('₹50,000.00')).toBeInTheDocument()
    expect(screen.getAllByText('₹12,000.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('₹38,000.00').length).toBeGreaterThan(0)
  })

  it('adds a fixed bill and updates the distributable balance', async () => {
    const user = userEvent.setup()
    render(<BudgetPlanner />)

    await screen.findByText('Rice')
    await user.type(screen.getByLabelText('Bill item'), 'Gas')
    await user.type(screen.getByLabelText('Amount (₹)'), '3000')
    await user.click(screen.getByRole('button', { name: 'Add fixed bill' }))

    expect(saveFixedBill).toHaveBeenCalledWith(
      expect.objectContaining({
        monthlyBudgetId: 'b1',
        label: 'Gas',
        amount: 3000,
      }),
    )
    expect((await screen.findAllByText('₹35,000.00')).length).toBeGreaterThan(0)
  })

  it('saves a weekly grocery and vegetable bill allocation', async () => {
    const user = userEvent.setup()
    render(<BudgetPlanner />)

    await screen.findByText('Rice')
    const vegInputs = screen.getAllByLabelText('Vegetable bill (₹)')
    const grocInputs = screen.getAllByLabelText('Grocery bill (₹)')
    const saveButtons = screen.getAllByRole('button', { name: 'Save week' })

    await user.clear(vegInputs[0])
    await user.type(vegInputs[0], '4000')
    await user.clear(grocInputs[0])
    await user.type(grocInputs[0], '5000')
    await user.click(saveButtons[0])

    expect(saveWeeklyAllocation).toHaveBeenCalledWith(
      expect.objectContaining({
        monthlyBudgetId: 'b1',
        groceryBill: 5000,
        vegetableBill: 4000,
        snacksBill: 0,
      }),
    )
  })
})

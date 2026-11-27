import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import DailyReview from './DailyReview'
import { finalizeMenu, getMenuByDate, reopenMenu, saveDraftMenu } from '../data/menus'
import { listRecipes } from '../data/recipes'
import { listIngredients } from '../data/ingredients'
import { listPurchases } from '../data/purchases'
import { computeDay } from '../lib/costing'
import type {
  DailyMenu,
  Ingredient,
  Purchase,
  Recipe,
} from '../lib/types'

vi.mock('../data/menus', () => ({
  getMenuByDate: vi.fn(),
  saveDraftMenu: vi.fn(),
  finalizeMenu: vi.fn(),
  reopenMenu: vi.fn(),
}))

vi.mock('../data/recipes', () => ({ listRecipes: vi.fn() }))
vi.mock('../data/ingredients', () => ({ listIngredients: vi.fn() }))
vi.mock('../data/purchases', () => ({ listPurchases: vi.fn() }))

const menuDate = '2026-11-26'

const ingredients: Ingredient[] = [
  { id: 'onion', name: 'Onion', unit: 'Kg', active: true },
  { id: 'tomato', name: 'Tomato', unit: 'Kg', active: true },
  { id: 'chilli', name: 'Green Chilli', unit: 'Kg', active: true },
  { id: 'coconut', name: 'Coconut', unit: 'Each', active: true },
]

const curry: Recipe = {
  id: 'curry',
  name: 'Vegetable Curry',
  baseServings: 50,
  active: true,
  items: [
    { ingredientId: 'onion', quantity: 2, unit: 'Kg' },
    { ingredientId: 'tomato', quantity: 1, unit: 'Kg' },
    { ingredientId: 'chilli', quantity: 250, unit: 'Gram' },
    { ingredientId: 'coconut', quantity: 5, unit: 'Each' },
  ],
}

function purchase(
  id: string,
  ingredientId: string,
  unitPrice: number,
  purchaseDate = '2026-11-24',
): Purchase {
  return {
    id,
    ingredientId,
    purchaseDate,
    unitPrice,
    quantity: 10,
    totalPrice: unitPrice * 10,
    createdAt: `${purchaseDate}T08:00:00.000Z`,
  }
}

const basePurchases = [
  purchase('p-onion', 'onion', 40),
  purchase('p-tomato', 'tomato', 30),
  purchase('p-chilli', 'chilli', 50),
]

const coconutPurchase = purchase('p-coconut', 'coconut', 12)

const draftMenu: DailyMenu = {
  id: 'm1',
  menuDate,
  studentCount: 100,
  bufferPercent: 0,
  recipeIds: ['curry'],
  overrides: {},
  status: 'draft',
  snapshot: null,
  finalizedAt: null,
}

function renderReview() {
  return render(
    <MemoryRouter initialEntries={[`/review/${menuDate}`]}>
      <Routes>
        <Route path="/review/:menuDate" element={<DailyReview />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getMenuByDate).mockResolvedValue(draftMenu)
  vi.mocked(listRecipes).mockResolvedValue([curry])
  vi.mocked(listIngredients).mockResolvedValue(ingredients)
  vi.mocked(listPurchases).mockResolvedValue(basePurchases)
  vi.mocked(saveDraftMenu).mockResolvedValue(draftMenu)
  vi.mocked(finalizeMenu).mockResolvedValue(undefined)
  vi.mocked(reopenMenu).mockResolvedValue(undefined)
})

describe('DailyReview screen', () => {
  it('flags a missing price and disables finalizing', async () => {
    renderReview()

    await screen.findByRole('heading', { name: 'Vegetable Curry' })
    expect(screen.getByText(/Missing price for Coconut/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Finalize day' })).toBeDisabled()
  })

  it('shows the total and cost per child once every price exists', async () => {
    vi.mocked(listPurchases).mockResolvedValue([...basePurchases, coconutPurchase])

    renderReview()

    await screen.findByRole('heading', { name: 'Vegetable Curry' })
    expect(screen.getAllByText('₹365.00').length).toBeGreaterThan(0)
    expect(screen.getByText('₹3.65')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Finalize day' })).toBeEnabled()
  })

  it('marks a price from a previous week as carried over', async () => {
    vi.mocked(listPurchases).mockResolvedValue([
      purchase('p-onion', 'onion', 40, '2026-11-20'),
      ...basePurchases.slice(1),
      coconutPurchase,
    ])

    renderReview()

    await screen.findByRole('heading', { name: 'Vegetable Curry' })
    expect(screen.getAllByText('carried over').length).toBeGreaterThan(0)
  })

  it('applies an override to a single line', async () => {
    const user = userEvent.setup()
    vi.mocked(listPurchases).mockResolvedValue([...basePurchases, coconutPurchase])

    renderReview()

    await screen.findByRole('heading', { name: 'Vegetable Curry' })
    await user.type(screen.getByLabelText('Override quantity for Onion'), '5')

    expect(await screen.findByText('overridden')).toBeInTheDocument()
    expect(screen.getByText('₹200.00')).toBeInTheDocument()
  })

  it('recalculates scaled quantities when the student count changes', async () => {
    const user = userEvent.setup()
    vi.mocked(listPurchases).mockResolvedValue([...basePurchases, coconutPurchase])

    renderReview()

    await screen.findByRole('heading', { name: 'Vegetable Curry' })
    const countInput = screen.getByLabelText('Student count')
    await user.clear(countInput)
    await user.type(countInput, '50')

    expect(await screen.findByText('₹80.00')).toBeInTheDocument()
  })

  it('requires a reason before reopening a finalized day', async () => {
    const user = userEvent.setup()
    const snapshot = computeDay({
      menuDate,
      studentCount: 100,
      bufferPercent: 0,
      recipes: [curry],
      ingredients,
      purchases: [...basePurchases, coconutPurchase],
    })
    vi.mocked(getMenuByDate).mockResolvedValue({
      ...draftMenu,
      status: 'finalized',
      snapshot,
      finalizedAt: '2026-11-26T10:00:00.000Z',
    })

    renderReview()

    await screen.findByRole('heading', { name: 'Reopen this day' })
    await user.click(screen.getByRole('button', { name: 'Reopen day' }))

    expect(await screen.findByText('Enter a reason to reopen this day.')).toBeInTheDocument()
    expect(reopenMenu).not.toHaveBeenCalled()
  })
})

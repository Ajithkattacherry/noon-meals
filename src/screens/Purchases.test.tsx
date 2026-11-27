import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Purchases from './Purchases'
import { listPurchases, addPurchase } from '../data/purchases'
import { listIngredients } from '../data/ingredients'
import type { Purchase } from '../lib/types'

vi.mock('../data/purchases', () => ({
  listPurchases: vi.fn(),
  addPurchase: vi.fn(),
}))

vi.mock('../data/ingredients', () => ({
  listIngredients: vi.fn(),
}))

const onion = {
  id: 'onion',
  name: 'Onion',
  unit: 'Kg' as const,
  description: null,
  active: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listIngredients).mockResolvedValue([onion])
  vi.mocked(listPurchases).mockResolvedValue([])
  vi.mocked(addPurchase).mockResolvedValue({
    id: 'new',
    ingredientId: 'onion',
    purchaseDate: '2026-11-24',
    quantity: 10,
    totalPrice: 400,
    unitPrice: 40,
    createdAt: '2026-11-24T08:00:00.000Z',
  })
})

describe('Purchases screen', () => {
  it('shows the calculated unit price before saving', async () => {
    const user = userEvent.setup()
    render(<Purchases />)

    await screen.findByText('No purchases recorded yet.')
    await user.selectOptions(screen.getByLabelText('Ingredient'), 'onion')
    await user.type(screen.getByLabelText('Quantity'), '10')
    await user.type(screen.getByLabelText('Total price (₹)'), '400')

    expect(await screen.findByText('₹40.00/Kg')).toBeInTheDocument()
    expect(addPurchase).not.toHaveBeenCalled()
  })

  it('rejects a quantity of zero or less', async () => {
    const user = userEvent.setup()
    render(<Purchases />)

    await screen.findByText('No purchases recorded yet.')
    await user.selectOptions(screen.getByLabelText('Ingredient'), 'onion')
    await user.type(screen.getByLabelText('Quantity'), '0')
    await user.type(screen.getByLabelText('Total price (₹)'), '400')
    await user.click(screen.getByRole('button', { name: 'Add purchase' }))

    expect(await screen.findByText('Quantity must be greater than zero.')).toBeInTheDocument()
    expect(addPurchase).not.toHaveBeenCalled()
  })

  it('shows history dates as DD-MMM-YYYY', async () => {
    const history: Purchase[] = [
      {
        id: 'p1',
        ingredientId: 'onion',
        purchaseDate: '2026-11-24',
        quantity: 10,
        totalPrice: 400,
        unitPrice: 40,
        supplier: 'Market stall',
        createdAt: '2026-11-24T08:00:00.000Z',
      },
    ]
    vi.mocked(listPurchases).mockResolvedValue(history)

    render(<Purchases />)

    expect(await screen.findByText('24-Nov-2026')).toBeInTheDocument()
    expect(screen.getByText('₹40.00')).toBeInTheDocument()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Purchases from './Purchases'
import { listPurchases, addPurchase, updatePurchase } from '../data/purchases'
import { listIngredients } from '../data/ingredients'
import type { Purchase } from '../lib/types'

vi.mock('../data/purchases', () => ({
  listPurchases: vi.fn(),
  addPurchase: vi.fn(),
  updatePurchase: vi.fn(),
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
  vi.mocked(updatePurchase).mockResolvedValue({
    id: 'p1',
    ingredientId: 'onion',
    purchaseDate: '2026-10-04',
    quantity: 12,
    totalPrice: 540,
    unitPrice: 45,
    createdAt: '2026-10-03T08:00:00.000Z',
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

  it('filters purchases by date range and shows total cost for the selection', async () => {
    const user = userEvent.setup()
    const history: Purchase[] = [
      {
        id: 'p1',
        ingredientId: 'onion',
        purchaseDate: '2026-10-03',
        quantity: 10,
        totalPrice: 400,
        unitPrice: 40,
        supplier: 'Cheerakuzhy Stores',
        createdAt: '2026-10-03T08:00:00.000Z',
      },
      {
        id: 'p2',
        ingredientId: 'onion',
        purchaseDate: '2026-10-10',
        quantity: 15,
        totalPrice: 675,
        unitPrice: 45,
        supplier: 'Cheerakuzhy Stores',
        createdAt: '2026-10-10T08:00:00.000Z',
      },
      {
        id: 'p3',
        ingredientId: 'onion',
        purchaseDate: '2026-10-20',
        quantity: 5,
        totalPrice: 250,
        unitPrice: 50,
        supplier: 'Cheerakuzhy Stores',
        createdAt: '2026-10-20T08:00:00.000Z',
      },
    ]
    vi.mocked(listPurchases).mockResolvedValue(history)

    render(<Purchases />)

    await screen.findByText('03-Oct-2026')
    expect(screen.getByText('₹1,325.00')).toBeInTheDocument()

    await user.type(screen.getByLabelText('From date'), '2026-10-03')
    await user.type(screen.getByLabelText('To date'), '2026-10-10')

    expect(screen.getByText('03-Oct-2026')).toBeInTheDocument()
    expect(screen.getByText('10-Oct-2026')).toBeInTheDocument()
    expect(screen.queryByText('20-Oct-2026')).not.toBeInTheDocument()
    expect(screen.getByText('₹1,075.00')).toBeInTheDocument()
  })

  it('edits an existing purchase from purchase history', async () => {
    const user = userEvent.setup()
    const history: Purchase[] = [
      {
        id: 'p1',
        ingredientId: 'onion',
        purchaseDate: '2026-10-03',
        quantity: 10,
        totalPrice: 400,
        unitPrice: 40,
        supplier: 'Cheerakuzhy Stores',
        notes: 'Initial',
        createdAt: '2026-10-03T08:00:00.000Z',
      },
    ]
    vi.mocked(listPurchases).mockResolvedValue(history)

    render(<Purchases />)

    await screen.findByText('03-Oct-2026')
    await user.click(screen.getByRole('button', { name: 'Edit' }))

    expect(screen.getByRole('heading', { name: 'Edit purchase' })).toBeInTheDocument()

    const dateInput = screen.getByLabelText('Purchase date')
    const qtyInput = screen.getByLabelText('Quantity')
    const totalInput = screen.getByLabelText('Total price (₹)')

    await user.clear(dateInput)
    await user.type(dateInput, '2026-10-04')
    await user.clear(qtyInput)
    await user.type(qtyInput, '12')
    await user.clear(totalInput)
    await user.type(totalInput, '540')

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updatePurchase).toHaveBeenCalledWith({
      id: 'p1',
      ingredientId: 'onion',
      purchaseDate: '2026-10-04',
      quantity: 12,
      totalPrice: 540,
      supplier: 'Cheerakuzhy Stores',
      notes: 'Initial',
    })
  })
})

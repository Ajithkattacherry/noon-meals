import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReceiptScanner from './ReceiptScanner'
import {
  computeFileHash,
  createReceiptUpload,
  deleteReceiptUpload,
  listReceiptUploads,
  parseReceiptWithEdgeFunction,
  uploadReceiptFile,
} from '../data/receipts'
import { addPurchase } from '../data/purchases'
import { getMonthlyBudget, saveFixedBill } from '../data/budgets'
import type { Ingredient } from '../lib/types'

vi.mock('../data/receipts', () => ({
  computeFileHash: vi.fn(),
  listReceiptUploads: vi.fn(),
  uploadReceiptFile: vi.fn(),
  parseReceiptWithEdgeFunction: vi.fn(),
  createReceiptUpload: vi.fn(),
  deleteReceiptUpload: vi.fn(),
  getReceiptSignedUrl: vi.fn(),
}))
vi.mock('../data/purchases', () => ({
  addPurchase: vi.fn(),
}))
vi.mock('../data/budgets', () => ({
  getMonthlyBudget: vi.fn(),
  saveMonthlyBudgetTarget: vi.fn(),
  saveFixedBill: vi.fn(),
}))

const ingredients: Ingredient[] = [
  { id: 'onion', name: 'Onion', unit: 'Kg', category: 'vegetable', active: true },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(computeFileHash).mockResolvedValue('hash-new')
  vi.mocked(listReceiptUploads).mockResolvedValue([])
  vi.mocked(uploadReceiptFile).mockResolvedValue({
    storagePath: '2026-10-03/bill.jpg',
    fileName: 'bill.jpg',
    mimeType: 'image/jpeg',
  })
  vi.mocked(parseReceiptWithEdgeFunction).mockResolvedValue({
    supplier: 'Cheerakuzhy Stores',
    billNumber: '118',
    billDate: '2026-10-03',
    totalAmount: 2402.6,
    items: [
      {
        id: 'i1',
        rawName: 'Savala',
        matchedIngredientId: 'onion',
        matchedIngredientName: 'Onion',
        destination: 'purchase',
        category: 'vegetable',
        quantity: 10,
        unit: 'Kg',
        totalPrice: 450,
      },
      {
        id: 'i2',
        rawName: 'Gas Cylinder',
        matchedIngredientId: '',
        matchedIngredientName: null,
        destination: 'fixed_bill',
        category: 'fixed',
        quantity: 1,
        unit: 'Each',
        totalPrice: 1952.6,
      },
    ],
  })
  vi.mocked(createReceiptUpload).mockResolvedValue({
    id: 'rec-1',
    storagePath: '2026-10-03/bill.jpg',
  })
  vi.mocked(addPurchase).mockResolvedValue({
    id: 'pur-1',
    ingredientId: 'onion',
    purchaseDate: '2026-10-03',
    unitPrice: 45,
    createdAt: '2026-10-03T08:00:00Z',
  })
  vi.mocked(getMonthlyBudget).mockResolvedValue({
    budget: { id: 'b-oct', month: '2026-10', siteAmount: 42754, plannedTarget: 42754 },
    fixedBills: [],
    weeklyAllocations: [],
  })
  vi.mocked(saveFixedBill).mockResolvedValue({
    id: 'fb-1',
    monthlyBudgetId: 'b-oct',
    label: 'Gas Cylinder',
    billDate: '2026-10-03',
    amount: 1952.6,
  })
  vi.mocked(deleteReceiptUpload).mockResolvedValue()
})

describe('ReceiptScanner', () => {
  it('uploads, parses, and saves both ingredient purchases and fixed bills with receipt attached', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()

    render(<ReceiptScanner ingredients={ingredients} onSaved={onSaved} />)

    const file = new File(['dummy'], 'bill.jpg', { type: 'image/jpeg' })
    await user.upload(screen.getByLabelText('Receipt image or PDF'), file)
    await user.click(screen.getByRole('button', { name: 'Upload & parse bill' }))

    expect(await screen.findByDisplayValue('Cheerakuzhy Stores')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Gas Cylinder')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save all to database' }))

    expect(addPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        ingredientId: 'onion',
        purchaseDate: '2026-10-03',
        quantity: 10,
        totalPrice: 450,
        receiptId: 'rec-1',
        receiptPath: '2026-10-03/bill.jpg',
      }),
    )
    expect(saveFixedBill).toHaveBeenCalledWith(
      expect.objectContaining({
        monthlyBudgetId: 'b-oct',
        label: 'Gas Cylinder',
        billDate: '2026-10-03',
        amount: 1952.6,
        receiptId: 'rec-1',
        receiptPath: '2026-10-03/bill.jpg',
      }),
    )
    expect(onSaved).toHaveBeenCalled()
  })

  it('blocks duplicate file upload until user confirms Upload anyway', async () => {
    const user = userEvent.setup()
    vi.mocked(computeFileHash).mockResolvedValue('dup-hash')
    vi.mocked(listReceiptUploads).mockResolvedValue([
      {
        id: 'r-old',
        storagePath: '2026-10-03/old.jpg',
        fileName: 'old.jpg',
        mimeType: 'image/jpeg',
        fileHash: 'dup-hash',
        billNumber: '118',
        supplier: 'Cheerakuzhy Stores',
        billDate: '2026-10-03',
        totalAmount: 2942.5,
        targetType: 'purchase',
        status: 'saved',
        createdAt: '2026-10-03T08:00:00Z',
      },
    ])

    render(<ReceiptScanner ingredients={ingredients} onSaved={vi.fn()} />)
    await screen.findByRole('button', { name: 'Upload history (1)' })

    const file = new File(['dummy'], 'bill.jpg', { type: 'image/jpeg' })
    await user.upload(screen.getByLabelText('Receipt image or PDF'), file)
    await user.click(screen.getByRole('button', { name: 'Upload & parse bill' }))

    expect(await screen.findByText(/Duplicate file detected/i)).toBeInTheDocument()
    expect(uploadReceiptFile).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Upload anyway' }))
    expect(uploadReceiptFile).toHaveBeenCalled()
  })

  it('deletes an upload and linked entries from Upload history', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    vi.mocked(listReceiptUploads).mockResolvedValue([
      {
        id: 'r-old',
        storagePath: '2026-10-03/old.jpg',
        fileName: 'old.jpg',
        mimeType: 'image/jpeg',
        fileHash: 'dup-hash',
        billNumber: '118',
        supplier: 'Cheerakuzhy Stores',
        billDate: '2026-10-03',
        totalAmount: 2942.5,
        targetType: 'purchase',
        status: 'saved',
        createdAt: '2026-10-03T08:00:00Z',
      },
    ])

    render(<ReceiptScanner ingredients={ingredients} onSaved={onSaved} />)

    await user.click(await screen.findByRole('button', { name: 'Upload history (1)' }))
    expect(screen.getByText('Cheerakuzhy Stores')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }))

    expect(deleteReceiptUpload).toHaveBeenCalledWith('r-old', '2026-10-03/old.jpg')
    expect(onSaved).toHaveBeenCalled()
  })
})

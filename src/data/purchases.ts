import { errorMessage, requireSupabase } from './supabase'
import type { Purchase } from '../lib/types'

interface PurchaseRow {
  id: string
  ingredient_id: string
  purchase_date: string
  quantity: number
  total_price: number
  unit_price: number
  supplier: string | null
  notes: string | null
  created_at: string
}

export interface AddPurchaseInput {
  ingredientId: string
  purchaseDate: string
  quantity: number
  totalPrice: number
  supplier?: string
  notes?: string
}

function mapPurchase(row: PurchaseRow): Purchase {
  return {
    id: row.id,
    ingredientId: row.ingredient_id,
    purchaseDate: row.purchase_date,
    quantity: Number(row.quantity),
    totalPrice: Number(row.total_price),
    unitPrice: Number(row.unit_price),
    supplier: row.supplier,
    notes: row.notes,
    createdAt: row.created_at,
  }
}

const PURCHASE_COLUMNS =
  'id, ingredient_id, purchase_date, quantity, total_price, unit_price, supplier, notes, created_at'

/** Newest purchases first. */
export async function listPurchases(): Promise<Purchase[]> {
  const { data, error } = await requireSupabase()
    .from('purchases')
    .select(PURCHASE_COLUMNS)
    .order('purchase_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(errorMessage(error))
  return (data as PurchaseRow[]).map(mapPurchase)
}

/** Records a new purchase. */
export async function addPurchase(input: AddPurchaseInput): Promise<Purchase> {
  const { data, error } = await requireSupabase()
    .from('purchases')
    .insert({
      ingredient_id: input.ingredientId,
      purchase_date: input.purchaseDate,
      quantity: input.quantity,
      total_price: input.totalPrice,
      supplier: input.supplier?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .select(PURCHASE_COLUMNS)
    .single()

  if (error) throw new Error(errorMessage(error))
  return mapPurchase(data as PurchaseRow)
}

/** Updates an existing purchase; Postgres recalculates unit_price automatically. */
export async function updatePurchase(
  input: { id: string } & AddPurchaseInput,
): Promise<Purchase> {
  const { data, error } = await requireSupabase()
    .from('purchases')
    .update({
      ingredient_id: input.ingredientId,
      purchase_date: input.purchaseDate,
      quantity: input.quantity,
      total_price: input.totalPrice,
      supplier: input.supplier?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .eq('id', input.id)
    .select(PURCHASE_COLUMNS)
    .single()

  if (error) throw new Error(errorMessage(error))
  return mapPurchase(data as PurchaseRow)
}

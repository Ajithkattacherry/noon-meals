import { isISODate, roundMoney, todayISO } from './format'
import type {
  Ingredient,
  IngredientCategory,
  ParsedReceipt,
  ParsedReceiptItem,
  ReceiptItemDestination,
  ReceiptTargetType,
  Unit,
} from './types'

const UNIT_ALIASES: Record<string, Unit> = {
  kg: 'Kg',
  kgs: 'Kg',
  kilogram: 'Kg',
  kilograms: 'Kg',
  g: 'Gram',
  gm: 'Gram',
  gms: 'Gram',
  gram: 'Gram',
  grams: 'Gram',
  l: 'Liter',
  ltr: 'Liter',
  ltrs: 'Liter',
  liter: 'Liter',
  liters: 'Liter',
  litre: 'Liter',
  litres: 'Liter',
  ml: 'Millilitre',
  millilitre: 'Millilitre',
  millilitres: 'Millilitre',
  milliliter: 'Millilitre',
  each: 'Each',
  nos: 'Each',
  no: 'Each',
  pc: 'Each',
  pcs: 'Each',
  pkt: 'Each',
  pkts: 'Each',
  packet: 'Each',
  packets: 'Each',
  box: 'Each',
}

export function normalizeUnit(raw?: string | null): Unit {
  if (!raw) return 'Each'
  const key = raw.trim().toLowerCase()
  return UNIT_ALIASES[key] ?? 'Each'
}

export function normalizeCategory(raw?: string | null): IngredientCategory {
  if (raw === 'fixed' || raw === 'grocery' || raw === 'vegetable' || raw === 'snacks') {
    return raw
  }
  return 'grocery'
}

export function matchIngredient(
  candidates: (string | null | undefined)[],
  ingredients: Ingredient[],
): Ingredient | null {
  const active = ingredients.filter((i) => i.active !== false)
  const cleaned = candidates
    .map((c) => c?.trim().toLowerCase())
    .filter((c): c is string => Boolean(c))

  for (const term of cleaned) {
    const exact = active.find((ing) => ing.name.trim().toLowerCase() === term)
    if (exact) return exact
  }

  for (const term of cleaned) {
    const partial = active.find((ing) => {
      const name = ing.name.trim().toLowerCase()
      return name.includes(term) || term.includes(name)
    })
    if (partial) return partial
  }

  return null
}

export interface RawEdgeReceiptItem {
  rawName?: string
  matchedIngredientName?: string | null
  destination?: string
  category?: string
  quantity?: number | string
  unit?: string
  totalPrice?: number | string
}

export interface RawEdgeReceipt {
  supplier?: string | null
  billNumber?: string | null
  billDate?: string | null
  totalAmount?: number | string | null
  items?: RawEdgeReceiptItem[]
}

export function normalizeParsedReceipt(
  raw: RawEdgeReceipt,
  ingredients: Ingredient[],
  fallbackDate: string = todayISO(),
): ParsedReceipt {
  const billDate = raw.billDate && isISODate(raw.billDate) ? raw.billDate : fallbackDate
  const totalAmountNum =
    raw.totalAmount !== null && raw.totalAmount !== undefined && raw.totalAmount !== ''
      ? Number(raw.totalAmount)
      : null

  const items: ParsedReceiptItem[] = (raw.items ?? []).map((item, idx) => {
    const rawName = (item.rawName ?? '').trim() || `Item ${idx + 1}`
    const matched = matchIngredient([item.matchedIngredientName, rawName], ingredients)
    const category = matched?.category ?? normalizeCategory(item.category)
    const destination: ReceiptItemDestination =
      item.destination === 'fixed_bill' || category === 'fixed'
        ? 'fixed_bill'
        : 'purchase'

    const qty = Number(item.quantity)
    const price = Number(item.totalPrice)

    return {
      id: `item-${idx + 1}`,
      rawName,
      matchedIngredientId: matched?.id ?? '',
      matchedIngredientName: matched?.name ?? item.matchedIngredientName ?? null,
      destination,
      category,
      quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
      unit: matched?.unit ?? normalizeUnit(item.unit),
      totalPrice: Number.isFinite(price) && price >= 0 ? roundMoney(price) : 0,
    }
  })

  return {
    supplier: (raw.supplier ?? '').trim(),
    billNumber: (raw.billNumber ?? '').trim(),
    billDate,
    totalAmount:
      totalAmountNum !== null && Number.isFinite(totalAmountNum) && totalAmountNum >= 0
        ? roundMoney(totalAmountNum)
        : null,
    items,
  }
}

export function determineTargetType(items: ParsedReceiptItem[]): ReceiptTargetType {
  const hasPurchase = items.some((item) => item.destination === 'purchase')
  const hasFixed = items.some((item) => item.destination === 'fixed_bill')
  if (hasPurchase && hasFixed) return 'mixed'
  if (hasFixed) return 'fixed_bill'
  return 'purchase'
}

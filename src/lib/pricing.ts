import type { PriceRef, Purchase } from './types'

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function toISO(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/**
 * Returns the Monday of the week containing `isoDate` as a `YYYY-MM-DD` string.
 * A week runs Monday to Sunday. Uses `Date.UTC` only for weekday arithmetic, so
 * the result never depends on the machine's timezone.
 */
export function weekStart(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const weekday = date.getUTCDay() // 0 = Sunday ... 6 = Saturday
  const offsetFromMonday = (weekday + 6) % 7
  date.setUTCDate(date.getUTCDate() - offsetFromMonday)
  return toISO(date)
}

/**
 * Finds the price to use for an ingredient on a menu date: the most recent
 * purchase on or before that date. A purchase from an earlier week is marked
 * `carriedOver`. Returns `null` when no usable purchase exists, which callers
 * must treat as "missing price", never as zero.
 */
export function findApplicablePrice(
  purchases: Purchase[],
  ingredientId: string,
  menuDate: string,
): PriceRef | null {
  const candidates = purchases.filter(
    (purchase) =>
      purchase.ingredientId === ingredientId && purchase.purchaseDate <= menuDate,
  )
  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    if (a.purchaseDate !== b.purchaseDate) {
      return a.purchaseDate < b.purchaseDate ? -1 : 1
    }
    if (a.createdAt !== b.createdAt) {
      return a.createdAt < b.createdAt ? -1 : 1
    }
    return 0
  })

  const latest = candidates[candidates.length - 1]
  return {
    purchaseId: latest.id,
    purchaseDate: latest.purchaseDate,
    unitPrice: latest.unitPrice,
    carriedOver: latest.purchaseDate < weekStart(menuDate),
  }
}

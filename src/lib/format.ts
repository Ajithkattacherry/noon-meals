const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

/**
 * Formats a number as Indian rupees with Indian digit grouping.
 * Example: 125000 -> "₹1,25,000.00"
 */
export function formatINR(amount: number): string {
  const value = Number.isFinite(amount) ? amount : 0
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Formats a `YYYY-MM-DD` date string as `DD-MMM-YYYY` (for example
 * `2026-11-26` -> `26-Nov-2026`). Deliberately never builds a `Date` object so
 * the result cannot drift with the browser's local timezone.
 */
export function formatDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate)
  if (!match) return isoDate
  const [, year, month, day] = match
  const monthName = MONTHS[Number(month) - 1] ?? month
  return `${day}-${monthName}-${year}`
}

/**
 * Formats a quantity with its unit for display: whole items are shown as
 * integers, weight and volume keep up to three decimals with trailing zeros
 * removed (for example `4 Kg`, `0.25 Kg`, `10 Each`).
 */
export function formatQuantity(quantity: number, unit: string): string {
  const rounded =
    unit === 'Each'
      ? Math.round(quantity)
      : Math.round((quantity + Number.EPSILON) * 1000) / 1000
  return `${rounded} ${unit}`
}

/** Rounds a rupee amount to two decimal places without float drift. */
export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100
}

/** Today's date as a `YYYY-MM-DD` string built from local calendar parts. */
export function todayISO(now: Date = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** True when the string looks like a valid `YYYY-MM-DD` calendar date. */
export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

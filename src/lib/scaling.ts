import type { Unit } from './types'

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/**
 * Scales a recipe's base quantity to the day's student count, applying the
 * optional buffer percentage.
 *
 * - Whole-item units (`Each`) are rounded to six decimals first and then
 *   rounded up, so 5 Each scaled for 100 children from a 50-serving recipe is
 *   exactly 10 (never 11 because of floating-point noise).
 * - Weight and volume units keep up to three decimals.
 */
export function scaleQuantity(
  baseQuantity: number,
  studentCount: number,
  baseServings: number,
  bufferPercent: number,
  unit: Unit,
): number {
  if (!(baseServings > 0)) {
    throw new Error('baseServings must be greater than zero')
  }
  const students = Number.isFinite(studentCount) ? Math.max(0, studentCount) : 0
  const buffer = Number.isFinite(bufferPercent) ? bufferPercent : 0
  const raw = baseQuantity * (students / baseServings) * (1 + buffer / 100)

  if (unit === 'Each') {
    return Math.ceil(roundTo(raw, 6))
  }
  return roundTo(raw, 3)
}

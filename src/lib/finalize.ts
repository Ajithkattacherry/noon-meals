import type { DayCalculation } from './types'

/**
 * A day may only be finalized when every line has a usable price and unit.
 * Missing prices are never treated as zero, so they block finalization.
 */
export function canFinalize(calc: DayCalculation): boolean {
  return calc.complete && calc.flags.length === 0
}

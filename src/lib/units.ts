import type { Unit } from './types'

export const UNITS: Unit[] = ['Kg', 'Gram', 'Liter', 'Millilitre', 'Each']

type Family = 'mass' | 'volume' | 'count'

interface UnitInfo {
  family: Family
  /** Size of one unit expressed in the family's base unit. */
  factor: number
}

const UNIT_INFO: Record<Unit, UnitInfo> = {
  Kg: { family: 'mass', factor: 1000 },
  Gram: { family: 'mass', factor: 1 },
  Liter: { family: 'volume', factor: 1000 },
  Millilitre: { family: 'volume', factor: 1 },
  Each: { family: 'count', factor: 1 },
}

export const UNIT_FAMILY: Record<Unit, Family> = {
  Kg: 'mass',
  Gram: 'mass',
  Liter: 'volume',
  Millilitre: 'volume',
  Each: 'count',
}

/** Units that may be used for a given ingredient unit (itself included). */
export function compatibleUnits(unit: Unit): Unit[] {
  return UNITS.filter((candidate) => UNIT_FAMILY[candidate] === UNIT_FAMILY[unit])
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/**
 * Converts a quantity between units of the same family. Returns `null` when the
 * units are incompatible (for example Each to Kg), so callers can flag the line
 * instead of silently treating it as zero.
 */
export function convertQuantity(quantity: number, from: Unit, to: Unit): number | null {
  if (!Number.isFinite(quantity)) return null
  const fromInfo = UNIT_INFO[from]
  const toInfo = UNIT_INFO[to]
  if (!fromInfo || !toInfo || fromInfo.family !== toInfo.family) return null
  if (from === to) return quantity
  return roundTo((quantity * fromInfo.factor) / toInfo.factor, 6)
}

/** True when the two units belong to the same measurement family. */
export function areUnitsCompatible(from: Unit, to: Unit): boolean {
  return UNIT_FAMILY[from] === UNIT_FAMILY[to]
}

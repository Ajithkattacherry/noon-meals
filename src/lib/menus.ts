/**
 * Returns the student count of the latest menu strictly before `menuDate`, so
 * the daily entry screen can pre-fill it. Returns `null` when there is none.
 */
export function previousStudentCount(
  menus: { menuDate: string; studentCount: number }[],
  menuDate: string,
): number | null {
  const earlier = menus.filter((menu) => menu.menuDate < menuDate)
  if (earlier.length === 0) return null

  const latest = earlier.reduce((best, menu) =>
    menu.menuDate > best.menuDate ? menu : best,
  )
  return latest.studentCount
}

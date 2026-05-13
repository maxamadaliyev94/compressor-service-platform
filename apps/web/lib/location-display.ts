/**
 * Название площадки/цеха (модель Object), если оно не дублирует название филиала.
 */
export function objectNameIfDistinctFromBranch(branchName: string, objectName: string): string | null {
  const b = branchName.trim()
  const o = objectName.trim()
  if (!o || o === b) return null
  return o
}

/** Текст для поиска в картах: город, адрес, филиал; цех — только если отличается от филиала. */
export function formatMapSearchAddress(input: {
  clientCity?: string | null
  branchAddress?: string | null
  branchName: string
  objectName: string
  clientName: string
}): string {
  const extra = objectNameIfDistinctFromBranch(input.branchName, input.objectName)
  const parts = [
    input.clientCity?.trim() || null,
    input.branchAddress?.trim() || null,
    input.branchName.trim() || null,
    extra,
    input.clientName.trim() || null,
  ]
  return parts.filter(Boolean).join(', ')
}

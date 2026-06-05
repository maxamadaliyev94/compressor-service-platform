import { db } from '@/lib/db'

export type EquipmentTypeRefRow = {
  id: string
  name: string
  nameRu: string
  isSystem: boolean
}

type EquipmentTypeRefLike = Pick<EquipmentTypeRefRow, 'name' | 'nameRu' | 'isSystem'>

/** Канонический код типа: системный `name` (COMPRESSOR), а не дубль по `nameRu`. */
export function buildEquipmentTypeCanonicalMap(types: EquipmentTypeRefLike[]): Map<string, string> {
  const canonicalByRu = new Map<string, string>()
  const map = new Map<string, string>()

  for (const t of types.filter((x) => x.isSystem)) {
    const ruKey = t.nameRu.trim().toLowerCase()
    canonicalByRu.set(ruKey, t.name)
    map.set(t.name, t.name)
    map.set(t.nameRu, t.name)
  }

  for (const t of types.filter((x) => !x.isSystem)) {
    const ruKey = t.nameRu.trim().toLowerCase()
    const canonical = canonicalByRu.get(ruKey) ?? t.name
    if (!canonicalByRu.has(ruKey)) canonicalByRu.set(ruKey, canonical)
    map.set(t.name, canonical)
    map.set(t.nameRu, canonical)
  }

  return map
}

export function normalizeEquipmentTypeCode(
  code: string,
  types: EquipmentTypeRefLike[]
): string {
  const trimmed = code.trim()
  if (!trimmed) return trimmed
  const map = buildEquipmentTypeCanonicalMap(types)
  if (map.has(trimmed)) return map.get(trimmed)!

  const systemByCode = types.find((t) => t.isSystem && t.name === trimmed)
  if (systemByCode) return systemByCode.name

  const byRu = types.find((t) => t.nameRu.trim().toLowerCase() === trimmed.toLowerCase())
  if (byRu) return map.get(byRu.name) ?? byRu.name

  return trimmed
}

export function equipmentTypesMatch(
  equipmentType: string,
  filterType: string,
  types: EquipmentTypeRefLike[]
): boolean {
  if (filterType === 'ALL') return true
  return (
    normalizeEquipmentTypeCode(equipmentType, types) ===
    normalizeEquipmentTypeCode(filterType, types)
  )
}

/** Опции фильтра: одна строка на `nameRu`, значение — канонический код. */
export function buildEquipmentTypeFilterOptions(
  types: EquipmentTypeRefRow[],
  equipmentCodes: string[]
): { name: string; nameRu: string }[] {
  const seenRu = new Set<string>()
  const options: { name: string; nameRu: string }[] = []

  const sorted = [...types].sort((a, b) => {
    if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1
    return a.nameRu.localeCompare(b.nameRu, 'ru')
  })

  for (const t of sorted) {
    const ruKey = t.nameRu.trim().toLowerCase()
    if (seenRu.has(ruKey)) continue
    seenRu.add(ruKey)
    options.push({
      name: normalizeEquipmentTypeCode(t.name, types),
      nameRu: t.nameRu,
    })
  }

  for (const code of equipmentCodes) {
    if (!code) continue
    const canonical = normalizeEquipmentTypeCode(code, types)
    const label =
      types.find((t) => t.name === canonical || normalizeEquipmentTypeCode(t.name, types) === canonical)
        ?.nameRu ?? code
    const ruKey = label.trim().toLowerCase()
    if (!seenRu.has(ruKey)) {
      seenRu.add(ruKey)
      options.push({ name: canonical, nameRu: label })
    }
  }

  return options.sort((a, b) => a.nameRu.localeCompare(b.nameRu, 'ru'))
}

export async function assertActiveEquipmentTypeCode(code: string): Promise<boolean> {
  const types = await fetchActiveEquipmentTypes()
  const normalized = normalizeEquipmentTypeCode(code, types)
  return types.some((t) => t.name === normalized || normalizeEquipmentTypeCode(t.name, types) === normalized)
}

export function equipmentTypeLabelMap(types: EquipmentTypeRefRow[]): Record<string, string> {
  const labels: Record<string, string> = {}
  for (const t of types) {
    labels[t.name] = t.nameRu
    labels[normalizeEquipmentTypeCode(t.name, types)] = t.nameRu
  }
  return labels
}

export async function fetchActiveEquipmentTypes(): Promise<EquipmentTypeRefRow[]> {
  return db.equipmentTypeRef.findMany({
    where: { isActive: true },
    orderBy: [{ isSystem: 'desc' }, { nameRu: 'asc' }],
    select: { id: true, name: true, nameRu: true, isSystem: true },
  })
}

export async function fetchEquipmentTypeLabelMap(): Promise<Record<string, string>> {
  const types = await fetchActiveEquipmentTypes()
  return equipmentTypeLabelMap(types)
}

import { db } from '@/lib/db'

export type EquipmentTypeRefRow = {
  id: string
  name: string
  nameRu: string
  isSystem: boolean
}

export async function assertActiveEquipmentTypeCode(code: string): Promise<boolean> {
  const row = await db.equipmentTypeRef.findFirst({
    where: { name: code, isActive: true },
    select: { id: true },
  })
  return Boolean(row)
}

export function equipmentTypeLabelMap(types: EquipmentTypeRefRow[]): Record<string, string> {
  return Object.fromEntries(types.map((t) => [t.name, t.nameRu]))
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

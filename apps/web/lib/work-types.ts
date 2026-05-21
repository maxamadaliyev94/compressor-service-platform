import { db } from '@/lib/db'

export type WorkTypeRefRow = {
  id: string
  code: string
  nameRu: string
  isSystem: boolean
  sortOrder: number
}

export async function assertActiveWorkTypeCode(code: string): Promise<boolean> {
  const row = await db.workTypeRef.findFirst({
    where: { code, isActive: true },
    select: { id: true },
  })
  return Boolean(row)
}

export function workTypeLabelMap(types: WorkTypeRefRow[]): Record<string, string> {
  return Object.fromEntries(types.map((t) => [t.code, t.nameRu]))
}

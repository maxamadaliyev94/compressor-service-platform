import { db } from '@/lib/db'
import { fetchActiveEquipmentTypes, normalizeEquipmentTypeCode } from '@/lib/equipment-types'
import type { RegulationTaskScope } from '@prisma/client'

export type MaintenanceRegulationWithItems = {
  id: string
  name: string
  equipmentType: string
  taskType: string
  taskScope: RegulationTaskScope
  intervalHours: number
  description: string | null
  items: { id: string; label: string; order: number }[]
}

export async function findMaintenanceRegulation(params: {
  taskType: string
  equipmentType: string
  taskScope: RegulationTaskScope
}): Promise<MaintenanceRegulationWithItems | null> {
  const equipmentTypes = await fetchActiveEquipmentTypes()
  const normalized = normalizeEquipmentTypeCode(params.equipmentType, equipmentTypes)
  const equipmentCandidates = [...new Set([normalized, params.equipmentType].filter(Boolean))]

  const scopesToTry: RegulationTaskScope[] =
    params.taskScope === 'LONG_TERM' ? ['LONG_TERM', 'QUICK'] : ['QUICK']

  for (const scope of scopesToTry) {
    for (const eqType of equipmentCandidates) {
      const reg = await db.maintenanceRegulation.findFirst({
        where: {
          taskType: params.taskType,
          equipmentType: eqType,
          taskScope: scope,
          isActive: true,
        },
        include: { items: { orderBy: { order: 'asc' } } },
      })
      if (reg && reg.items.length > 0) {
        return reg
      }
    }
  }

  return null
}

export const regulationTaskScopeLabels: Record<RegulationTaskScope, string> = {
  QUICK: 'Быстрые задачи',
  LONG_TERM: 'Долгосрочные задачи',
}

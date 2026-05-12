import { db } from '@/lib/db'

/** Сессия после проверки `auth()` (есть user.id и role). */
export type AuthedSession = {
  user: { id: string; role: string; clientId?: string | null }
}

export function isStaffRole(role: string): boolean {
  return role === 'ADMIN' || role === 'MANAGER' || role === 'CHIEF_ENGINEER'
}

export async function getEquipmentClientId(equipmentId: string): Promise<string | null> {
  const eq = await db.equipment.findUnique({
    where: { id: equipmentId },
    select: { object: { select: { branch: { select: { clientId: true } } } } },
  })
  return eq?.object.branch.clientId ?? null
}

export async function getBranchClientId(branchId: string): Promise<string | null> {
  const b = await db.branch.findUnique({ where: { id: branchId }, select: { clientId: true } })
  return b?.clientId ?? null
}

export async function getTaskClientId(taskId: string): Promise<string | null> {
  const t = await db.serviceTask.findUnique({
    where: { id: taskId },
    select: {
      equipment: { select: { object: { select: { branch: { select: { clientId: true } } } } } },
    },
  })
  return t?.equipment.object.branch.clientId ?? null
}

/** Задачи, где инженер участвует: основной исполнитель или запись в LongTermTaskEngineer. */
export function prismaWhereEngineerTaskAssignment(engineerId: string) {
  return {
    OR: [{ assignedToId: engineerId }, { longTermEngineers: { some: { engineerId } } }],
  }
}

/** Инженер имеет доступ к компании, если у него есть хотя бы одна назначенная задача на её оборудовании. */
export async function engineerHasTaskOnClient(engineerId: string, clientId: string): Promise<boolean> {
  const n = await db.serviceTask.count({
    where: {
      deletedAt: null,
      equipment: { object: { branch: { clientId } } },
      ...prismaWhereEngineerTaskAssignment(engineerId),
    },
  })
  return n > 0
}

/** Чтение данных компании (филиалы, список клиентов и т.п.). */
export async function canReadClientScope(session: AuthedSession, clientId: string): Promise<boolean> {
  const role = session.user.role
  if (role === 'ADMIN' || role === 'CHIEF_ENGINEER') return true
  if (role === 'MANAGER') {
    return true
  }
  if (role === 'ENGINEER') {
    return engineerHasTaskOnClient(session.user.id, clientId)
  }
  if (role === 'CLIENT') {
    return session.user.clientId === clientId
  }
  return false
}

/** Просмотр карточки оборудования (страница + PDF + история и т.д.). */
export async function canReadEquipment(session: AuthedSession, equipmentId: string): Promise<boolean> {
  const clientId = await getEquipmentClientId(equipmentId)
  if (!clientId) return false
  const role = session.user.role
  if (role === 'ADMIN' || role === 'CHIEF_ENGINEER') return true
  if (role === 'MANAGER') {
    return true
  }
  if (role === 'ENGINEER') {
    const n = await db.serviceTask.count({
      where: {
        equipmentId,
        deletedAt: null,
        ...prismaWhereEngineerTaskAssignment(session.user.id),
      },
    })
    return n > 0
  }
  if (role === 'CLIENT') {
    return session.user.clientId === clientId
  }
  return false
}

/** Изменение моточасов / комментариев к оборудованию. */
export async function canMutateEquipment(session: AuthedSession, equipmentId: string): Promise<boolean> {
  const role = session.user.role
  if (role === 'ADMIN' || role === 'CHIEF_ENGINEER') return true
  if (role === 'MANAGER') {
    const clientId = await getEquipmentClientId(equipmentId)
    return Boolean(clientId)
  }
  if (role === 'ENGINEER') {
    return canReadEquipment(session, equipmentId)
  }
  return false
}

/** Просмотр задачи (в т.ч. PDF). */
export async function canReadTask(session: AuthedSession, taskId: string): Promise<boolean> {
  const task = await db.serviceTask.findUnique({
    where: { id: taskId },
    select: {
      deletedAt: true,
      assignedToId: true,
      createdById: true,
      equipment: { select: { object: { select: { branch: { select: { clientId: true } } } } } },
      longTermEngineers: {
        where: { engineerId: session.user.id },
        select: { id: true },
        take: 1,
      },
    },
  })
  if (!task || task.deletedAt) return false
  const clientId = task.equipment.object.branch.clientId
  const role = session.user.role

  if (role === 'ADMIN' || role === 'CHIEF_ENGINEER') return true
  if (role === 'MANAGER') {
    return true
  }
  if (role === 'ENGINEER') {
    return task.assignedToId === session.user.id || task.longTermEngineers.length > 0
  }
  if (role === 'CLIENT') {
    return session.user.clientId === clientId
  }
  return false
}

/** Менеджер видит только задачи своих клиентов (для отчётов / графика). */
export function managerClientWhere(managerUserId: string) {
  return { object: { branch: { client: { managerId: managerUserId } } } }
}

/** Оборудование только закреплённых за менеджером клиентов (не пассивные). */
export function prismaWhereManagerEquipment(managerId: string) {
  return {
    object: {
      branch: {
        client: {
          managerId,
          status: { not: 'PASSIVE' as const },
        },
      },
    },
  }
}

/** Задачи только по оборудованию клиентов этого менеджера. */
export function prismaWhereManagerTasks(managerId: string) {
  return {
    equipment: {
      object: {
        branch: { client: { managerId } },
      },
    },
  }
}

/** Задачи только своей организации (портал клиента). Без привязки к клиенту — пустой результат. */
export function prismaWhereClientTasks(clientId: string | null | undefined) {
  if (!clientId) return { id: { in: [] as string[] } }
  return {
    equipment: {
      object: {
        branch: { clientId },
      },
    },
  }
}

/** Оборудование только своей организации (портал клиента). */
export function prismaWhereClientEquipment(clientId: string | null | undefined) {
  if (!clientId) return { id: { in: [] as string[] } }
  return {
    object: {
      branch: {
        clientId,
        client: { status: { not: 'PASSIVE' as const } },
      },
    },
  }
}

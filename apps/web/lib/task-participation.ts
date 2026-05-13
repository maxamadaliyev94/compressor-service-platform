import type { Prisma, TaskParticipantStatus } from '@prisma/client'

/** Инженер — основной исполнитель или в списке соисполнителей. */
export function engineerIsTaskParticipant(args: {
  userId: string
  assignedToId: string | null
  longTermEngineers: { engineerId: string }[]
}): boolean {
  if (args.assignedToId === args.userId) return true
  return args.longTermEngineers.some((r) => r.engineerId === args.userId)
}

/** ГИ только курирует заявку (не исполнитель по акту). */
export function chiefIsObserverOnly(args: {
  userId: string
  role: string
  managedByChiefId: string | null
  assignedToId: string | null
}): boolean {
  if (args.role !== 'CHIEF_ENGINEER') return false
  if (args.managedByChiefId !== args.userId) return false
  return args.assignedToId !== args.userId
}

export function participationStatusToUiTaskStatus(s: TaskParticipantStatus): string {
  if (s === 'DONE') return 'DONE'
  if (s === 'IN_PROGRESS') return 'IN_PROGRESS'
  return 'ASSIGNED'
}

/** Собирает id всех исполнителей для акта (без наблюдателя-ГИ). */
export function collectParticipantEngineerIdsForAct(args: {
  assignedToId: string | null
  managedByChiefId: string | null
  longTermEngineers: { engineerId: string }[]
  signingEngineerId: string
}): string[] {
  const set = new Set<string>()
  for (const r of args.longTermEngineers) set.add(r.engineerId)
  if (args.assignedToId) set.add(args.assignedToId)
  set.add(args.signingEngineerId)
  if (args.managedByChiefId) set.delete(args.managedByChiefId)
  return [...set]
}

export function participantEngineerIdsJson(ids: string[]): Prisma.InputJsonValue {
  return ids as unknown as Prisma.InputJsonValue
}

import { db } from '@/lib/db'
import { prismaWhereEngineerTaskAssignment } from '@/lib/api-access'

/**
 * Синхронизирует engineerStatus с реальностью: «Занят» только если есть задача в статусе IN_PROGRESS.
 * Статус OFFLINE не трогаем (инженер не на смене).
 */
export async function syncEngineerAvailabilityFromTasks(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { engineerStatus: true },
  })
  if (!user || user.engineerStatus === 'OFFLINE') return

  const inProgress = await db.serviceTask.count({
    where: {
      deletedAt: null,
      status: 'IN_PROGRESS',
      ...prismaWhereEngineerTaskAssignment(userId),
    },
  })

  await db.user.update({
    where: { id: userId },
    data: { engineerStatus: inProgress > 0 ? 'BUSY' : 'FREE' },
  })
}

/** Устаревшее имя: после назначения пересчитать занятость по IN_PROGRESS. */
export async function markEngineerBusy(userId: string) {
  await syncEngineerAvailabilityFromTasks(userId)
}

/** Устаревшее имя: пересчитать занятость по IN_PROGRESS. */
export async function syncEngineerFreeIfNoActiveTasks(userId: string) {
  await syncEngineerAvailabilityFromTasks(userId)
}

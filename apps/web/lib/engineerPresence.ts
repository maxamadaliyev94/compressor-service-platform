import { db } from '@/lib/db'

const ACTIVE_TASK_STATUSES = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'DRAFT', 'REVIEW'] as const

export async function markEngineerBusy(userId: string) {
  await db.user.update({
    where: { id: userId },
    data: {
      engineerStatus: 'BUSY',
      isOnline: true,
    },
  })
}

export async function syncEngineerFreeIfNoActiveTasks(userId: string) {
  const activeCount = await db.serviceTask.count({
    where: {
      assignedToId: userId,
      deletedAt: null,
      status: { in: [...ACTIVE_TASK_STATUSES] },
    },
  })

  if (activeCount === 0) {
    await db.user.update({
      where: { id: userId },
      data: { engineerStatus: 'FREE' },
    })
  }
}

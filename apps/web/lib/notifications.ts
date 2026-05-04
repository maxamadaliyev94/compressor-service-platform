import { db } from '@/lib/db'

export async function createNotification({
  userId,
  title,
  message,
  type = 'INFO',
  link,
}: {
  userId: string
  title: string
  message: string
  type?: string
  link?: string
}) {
  try {
    await db.notification.create({
      data: { userId, title, message, type, link },
    })
  } catch (e) {
    console.error('Notification error:', e)
  }
}

async function getClientNotifySubscriberByEquipmentId(
  equipmentId: string
): Promise<{ clientName: string; subscriberUserId: string | null } | null> {
  const row = await db.equipment.findUnique({
    where: { id: equipmentId },
    select: {
      object: {
        select: {
          branch: {
            select: {
              client: { select: { name: true, attachedNotifyUserId: true } },
            },
          },
        },
      },
    },
  })
  const client = row?.object?.branch?.client
  if (!client) return null
  return { clientName: client.name, subscriberUserId: client.attachedNotifyUserId }
}

/** Уведомление пользователя, прикреплённого к клиенту (по цепочке оборудование → объект → филиал → клиент). */
export async function notifyClientSubscriberForEquipmentWork(
  equipmentId: string,
  notification: { title: string; message: string; type?: string; link: string },
  opts?: { skipUserIds?: string[] }
): Promise<void> {
  const data = await getClientNotifySubscriberByEquipmentId(equipmentId)
  if (!data?.subscriberUserId) return
  const skip = new Set((opts?.skipUserIds ?? []).filter(Boolean))
  if (skip.has(data.subscriberUserId)) return
  const user = await db.user.findUnique({
    where: { id: data.subscriberUserId },
    select: { isActive: true },
  })
  if (!user?.isActive) return
  await createNotification({
    userId: data.subscriberUserId,
    title: notification.title,
    message: `${data.clientName}. ${notification.message}`.trim(),
    type: notification.type ?? 'INFO',
    link: notification.link,
  })
}

export async function notifyTaskAssigned(
  task: { id: string; type: string; priority: string; comment: string | null },
  assignedUser: { id: string },
  createdByUser: { name: string }
) {
  const typeLabels: Record<string, string> = {
    PLANNED_MAINTENANCE: 'Плановое ТО',
    DIAGNOSTICS: 'Диагностика',
    WARRANTY_REPAIR: 'Гарантийный ремонт',
    EMERGENCY: 'Аварийный выезд',
    INSTALLATION: 'Монтаж',
    COMMISSIONING: 'Пусконаладка',
  }
  await createNotification({
    userId: assignedUser.id,
    title: `Новая задача: ${typeLabels[task.type] || task.type}`,
    message: `Вам назначена задача от ${createdByUser.name}. ${task.comment || ''}`.trim(),
    type: task.priority === 'EMERGENCY' ? 'URGENT' : 'TASK',
    link: `/tasks/${task.id}`,
  })
}

export async function notifyLongTermEngineerAssigned(
  taskId: string,
  requestNumber: number,
  engineerId: string,
  periodText: string
) {
  const period = periodText.trim()
  await createNotification({
    userId: engineerId,
    title: `Долгосрочная задача №${requestNumber}`,
    message: `Вы назначены на долгосрочную задачу №${requestNumber}${period ? ` ${period}` : ''}.`,
    type: 'TASK',
    link: `/tasks/${taskId}`,
  })
}

export async function notifyEngineerRemovedFromTask(
  taskId: string,
  requestNumber: number,
  engineerId: string
) {
  await createNotification({
    userId: engineerId,
    title: `Задача №${requestNumber}`,
    message: `Вы сняты с задачи №${requestNumber}.`,
    type: 'INFO',
    link: `/tasks/${taskId}`,
  })
}

export async function notifyEngineerAssignedQuickTask(
  taskId: string,
  requestNumber: number,
  engineerId: string
) {
  await createNotification({
    userId: engineerId,
    title: `Задача №${requestNumber}`,
    message: `Вы назначены на задачу №${requestNumber}.`,
    type: 'TASK',
    link: `/tasks/${taskId}`,
  })
}

export async function notifyLongTermEndDateChanged(
  taskId: string,
  requestNumber: number,
  engineerIds: string[],
  newEndDateLabel: string
) {
  const unique = [...new Set(engineerIds)]
  for (const userId of unique) {
    await createNotification({
      userId,
      title: `Задача №${requestNumber}`,
      message: `Срок задачи №${requestNumber} изменён на ${newEndDateLabel}.`,
      type: 'INFO',
      link: `/tasks/${taskId}`,
    })
  }
}

export async function notifyTaskCompletedForUser(
  taskId: string,
  requestNumber: number,
  userId: string
) {
  await createNotification({
    userId,
    title: `Задача №${requestNumber} завершена`,
    message: `Задача №${requestNumber} завершена.`,
    type: 'SUCCESS',
    link: `/tasks/${taskId}`,
  })
}

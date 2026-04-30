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

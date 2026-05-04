import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createNotification, notifyClientSubscriberForEquipmentWork } from '@/lib/notifications'
import { hasPermission } from '@/lib/permissions'
import { markEngineerBusy, syncEngineerFreeIfNoActiveTasks } from '@/lib/engineerPresence'
import { parseDelegationParentTaskId } from '@/lib/task-delegation'
import type { Role, ServiceTask, TaskStatus } from '@prisma/client'

function canExecuteServiceTask(
  role: Role,
  userId: string,
  task: ServiceTask & { longTermEngineers?: { id: string }[] }
): boolean {
  if (role === 'CLIENT') return false
  if (role === 'ADMIN' || role === 'MANAGER' || role === 'CHIEF_ENGINEER') return true
  if (role === 'ENGINEER') {
    if (task.assignedToId === userId) return true
    if (task.taskType === 'LONG_TERM' && (task.longTermEngineers?.length ?? 0) > 0) return true
    return false
  }
  return false
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { status } = (await req.json()) as { status?: TaskStatus }
  if (!status) return NextResponse.json({ error: 'status обязателен' }, { status: 400 })

  const task = await db.serviceTask.findUnique({
    where: { id: params.id },
    include: {
      longTermEngineers: {
        where: { engineerId: session.user.id },
        select: { id: true },
      },
    },
  })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (task.deletedAt) {
    return NextResponse.json({ error: 'Задача находится в корзине' }, { status: 400 })
  }

  if (!canExecuteServiceTask(session.user.role as Role, session.user.id, task)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (status === 'DONE') {
    const canCloseTask = await hasPermission(session.user.role as Role, 'action:task.close')
    if (!canCloseTask) {
      return NextResponse.json({ error: 'Нет прав на закрытие задачи' }, { status: 403 })
    }
  }

  if (status === 'CANCELLED' && session.user.role !== 'ADMIN') {
    if (session.user.role === 'CHIEF_ENGINEER') {
      const parentId = parseDelegationParentTaskId(task.comment)
      if (!parentId) {
        return NextResponse.json({ error: 'Только администратор может отменять задачи' }, { status: 403 })
      }
      const parent = await db.serviceTask.findUnique({
        where: { id: parentId },
        select: { assignedToId: true, deletedAt: true },
      })
      if (!parent || parent.deletedAt || parent.assignedToId !== session.user.id) {
        return NextResponse.json({ error: 'Только администратор может отменять задачи' }, { status: 403 })
      }
    } else {
      return NextResponse.json({ error: 'Только администратор может отменять задачи' }, { status: 403 })
    }
  }

  if (task.status === 'DONE' || task.status === 'CANCELLED') {
    return NextResponse.json({ error: 'Задача уже закрыта' }, { status: 400 })
  }

  const previousStatus = task.status

  const updated = await db.serviceTask.update({
    where: { id: params.id },
    data: { status },
  })

  if (status === 'IN_PROGRESS' && updated.assignedToId) {
    await markEngineerBusy(updated.assignedToId)
  }
  if (status === 'DONE' || status === 'CANCELLED') {
    const idsToSync = new Set<string>()
    if (updated.assignedToId) idsToSync.add(updated.assignedToId)
    if (task.taskType === 'LONG_TERM') {
      const ltRows = await db.longTermTaskEngineer.findMany({
        where: { taskId: task.id },
        select: { engineerId: true },
      })
      for (const r of ltRows) idsToSync.add(r.engineerId)
    }
    for (const uid of idsToSync) {
      await syncEngineerFreeIfNoActiveTasks(uid)
    }
  }

  const notifyCreatorInProgress =
    status === 'IN_PROGRESS' &&
    previousStatus !== 'IN_PROGRESS' &&
    !!task.createdById &&
    task.createdById !== session.user.id

  if (notifyCreatorInProgress && task.createdById) {
    await createNotification({
      userId: task.createdById,
      title: 'Задача взята в работу',
      message: 'Инженер приступил к выполнению задачи',
      type: 'INFO',
      link: `/tasks/${task.id}`,
    })
  }

  if (status === 'DONE' && task.createdById) {
    await createNotification({
      userId: task.createdById,
      title: '✅ Задача выполнена',
      message: 'Задача успешно закрыта инженером',
      type: 'SUCCESS',
      link: `/tasks/${task.id}`,
    })
  }

  if (status === 'IN_PROGRESS' && previousStatus !== 'IN_PROGRESS') {
    await notifyClientSubscriberForEquipmentWork(
      task.equipmentId,
      {
        title: 'Задача в работе',
        message: 'Инженер приступил к выполнению задачи.',
        type: 'INFO',
        link: `/tasks/${task.id}`,
      },
      { skipUserIds: notifyCreatorInProgress && task.createdById ? [task.createdById] : [] }
    )
  }

  if (status === 'DONE') {
    await notifyClientSubscriberForEquipmentWork(
      task.equipmentId,
      {
        title: '✅ Задача выполнена',
        message: 'Задача закрыта (смена статуса).',
        type: 'SUCCESS',
        link: `/tasks/${task.id}`,
      },
      { skipUserIds: task.createdById ? [task.createdById] : [] }
    )
  }

  if (status === 'CANCELLED') {
    await notifyClientSubscriberForEquipmentWork(task.equipmentId, {
      title: 'Задача отменена',
      message: 'Задача по оборудованию клиента отменена.',
      type: 'WARNING',
      link: `/tasks/${task.id}`,
    })
  }

  return NextResponse.json(updated)
}

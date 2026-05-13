import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createNotification, notifyClientSubscriberForEquipmentWork, notifyEngineerRemovedFromTask } from '@/lib/notifications'
import { hasPermission } from '@/lib/permissions'
import { markEngineerBusy, syncEngineerFreeIfNoActiveTasks } from '@/lib/engineerPresence'
import { parseDelegationParentTaskId } from '@/lib/task-delegation'
import type { Role, ServiceTask, TaskStatus } from '@prisma/client'
import { announceTaskCompletedInGeneralChat } from '@/lib/internal-chat'

const MUTABLE_STATUSES = new Set<TaskStatus>(['ASSIGNED', 'IN_PROGRESS', 'DONE', 'CANCELLED'])
const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  NEW: ['ASSIGNED', 'IN_PROGRESS', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['DONE', 'CANCELLED'],
  DRAFT: ['IN_PROGRESS', 'CANCELLED'],
  REVIEW: ['IN_PROGRESS', 'CANCELLED'],
  REVISION: ['IN_PROGRESS', 'CANCELLED'],
  DONE: [],
  CANCELLED: [],
}

function canExecuteServiceTask(
  role: Role,
  userId: string,
  task: ServiceTask & { longTermEngineers?: { id: string; engineerId: string }[] }
): boolean {
  if (role === 'CLIENT') return false
  if (role === 'ADMIN' || role === 'MANAGER') return true
  if (role === 'CHIEF_ENGINEER') {
    if (task.managedByChiefId === userId && task.assignedToId !== userId) {
      return false
    }
    return true
  }
  if (role === 'ENGINEER') {
    if (task.assignedToId === userId) return true
    if ((task.longTermEngineers?.length ?? 0) > 0) {
      return task.longTermEngineers!.some((r) => r.engineerId === userId)
    }
    return false
  }
  return false
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { status } = (await req.json()) as { status?: TaskStatus }
  if (!status) return NextResponse.json({ error: 'status обязателен' }, { status: 400 })
  if (!MUTABLE_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Можно менять только статусы ASSIGNED/IN_PROGRESS/DONE/CANCELLED' }, { status: 400 })
  }

  const task = await db.serviceTask.findUnique({
    where: { id: params.id },
    include: {
      longTermEngineers: {
        select: { id: true, engineerId: true },
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
        select: { assignedToId: true, managedByChiefId: true, deletedAt: true },
      })
      if (
        !parent ||
        parent.deletedAt ||
        (parent.assignedToId !== session.user.id && parent.managedByChiefId !== session.user.id)
      ) {
        return NextResponse.json({ error: 'Только администратор может отменять задачи' }, { status: 403 })
      }
    } else {
      return NextResponse.json({ error: 'Только администратор может отменять задачи' }, { status: 403 })
    }
  }

  if (task.status === 'DONE' || task.status === 'CANCELLED') {
    return NextResponse.json({ error: 'Задача уже закрыта' }, { status: 400 })
  }
  const canMoveTo = ALLOWED_TRANSITIONS[task.status]?.includes(status) ?? false
  if (!canMoveTo) {
    return NextResponse.json(
      { error: `Недопустимый переход статуса: ${task.status} → ${status}` },
      { status: 400 }
    )
  }

  const previousStatus = task.status

  const updated = await db.serviceTask.update({
    where: { id: params.id },
    data: {
      status,
      ...(status === 'DONE' ? { completedAt: new Date() } : {}),
    },
  })

  if (status === 'IN_PROGRESS' && session.user.role === 'ENGINEER') {
    const lte = await db.longTermTaskEngineer.findFirst({
      where: { taskId: task.id, engineerId: session.user.id },
      select: { id: true },
    })
    if (lte) {
      await db.longTermTaskEngineer.update({
        where: { id: lte.id },
        data: { participationStatus: 'IN_PROGRESS' },
      })
    }
  }

  if (status === 'IN_PROGRESS') {
    const busyIds = new Set<string>()
    if (updated.assignedToId) busyIds.add(updated.assignedToId)
    const ltRows = await db.longTermTaskEngineer.findMany({
      where: { taskId: task.id },
      select: { engineerId: true },
    })
    for (const r of ltRows) busyIds.add(r.engineerId)
    for (const uid of busyIds) {
      await markEngineerBusy(uid)
    }
  }
  if (status === 'DONE' || status === 'CANCELLED') {
    const idsToSync = new Set<string>()
    if (updated.assignedToId) idsToSync.add(updated.assignedToId)
    const ltRows = await db.longTermTaskEngineer.findMany({
      where: { taskId: task.id },
      select: { engineerId: true },
    })
    for (const r of ltRows) idsToSync.add(r.engineerId)
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
    await announceTaskCompletedInGeneralChat(task.id, session.user.id)
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
    if (task.assignedToId) {
      await notifyEngineerRemovedFromTask(task.id, task.requestNumber, task.assignedToId)
    }
    await notifyClientSubscriberForEquipmentWork(task.equipmentId, {
      title: 'Задача отменена',
      message: 'Задача по оборудованию клиента отменена.',
      type: 'WARNING',
      link: `/tasks/${task.id}`,
    })
  }

  return NextResponse.json(updated)
}

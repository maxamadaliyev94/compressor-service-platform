import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createNotification } from '@/lib/notifications'
import { hasPermission } from '@/lib/permissions'
import { markEngineerBusy, syncEngineerFreeIfNoActiveTasks } from '@/lib/engineerPresence'
import type { Role, ServiceTask, TaskStatus } from '@prisma/client'

function canExecuteServiceTask(role: Role, userId: string, task: ServiceTask): boolean {
  if (role === 'CLIENT') return false
  if (role === 'ADMIN' || role === 'MANAGER' || role === 'CHIEF_ENGINEER') return true
  if (role === 'ENGINEER') return task.assignedToId === userId
  return false
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { status } = (await req.json()) as { status?: TaskStatus }
  if (!status) return NextResponse.json({ error: 'status обязателен' }, { status: 400 })

  const task = await db.serviceTask.findUnique({ where: { id: params.id } })
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
    return NextResponse.json({ error: 'Только администратор может отменять задачи' }, { status: 403 })
  }

  if (task.status === 'DONE' || task.status === 'CANCELLED') {
    return NextResponse.json({ error: 'Задача уже закрыта' }, { status: 400 })
  }

  const previousStatus = task.status

  const updated = await db.serviceTask.update({
    where: { id: params.id },
    data: { status },
  })

  if (updated.assignedToId) {
    if (status === 'IN_PROGRESS') {
      await markEngineerBusy(updated.assignedToId)
    }
    if (status === 'DONE' || status === 'CANCELLED') {
      await syncEngineerFreeIfNoActiveTasks(updated.assignedToId)
    }
  }

  if (
    status === 'IN_PROGRESS' &&
    previousStatus !== 'IN_PROGRESS' &&
    task.createdById &&
    task.createdById !== session.user.id
  ) {
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

  return NextResponse.json(updated)
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { syncEngineerFreeIfNoActiveTasks, markEngineerBusy } from '@/lib/engineerPresence'
import { parseDelegationParentTaskId } from '@/lib/task-delegation'
import { notifyTaskAssigned } from '@/lib/notifications'
import type { Role, TaskWorkType } from '@prisma/client'

/** ГИ владеет родительской заявкой для этой дочерней распределённой задачи. */
async function chiefOwnsDelegationParent(task: { comment: string | null }, chiefUserId: string): Promise<boolean> {
  const parentId = parseDelegationParentTaskId(task.comment)
  if (!parentId) return false
  const parent = await db.serviceTask.findUnique({
    where: { id: parentId },
    select: { assignedToId: true, deletedAt: true },
  })
  return Boolean(parent && !parent.deletedAt && parent.assignedToId === chiefUserId)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as {
    scheduledAt?: string | null
    assignedToId?: string | null
    taskType?: TaskWorkType
  } | null
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 })
  }

  const hasScheduled = 'scheduledAt' in body
  const hasAssignee = 'assignedToId' in body
  const hasTaskType = 'taskType' in body
  if (!hasScheduled && !hasAssignee && !hasTaskType) {
    return NextResponse.json({ error: 'Укажите scheduledAt, assignedToId или taskType' }, { status: 400 })
  }

  const role = session.user.role as Role
  const task = await db.serviceTask.findUnique({
    where: { id: params.id },
    include: { report: { select: { id: true } } },
  })
  if (!task || task.deletedAt) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (['DONE', 'CANCELLED'].includes(task.status)) {
    return NextResponse.json({ error: 'Нельзя изменить закрытую задачу' }, { status: 400 })
  }

  let nextTaskType: TaskWorkType | undefined
  let nextManagedByChiefId: string | null | undefined

  if (hasTaskType) {
    const tt = body.taskType
    if (tt !== 'QUICK' && tt !== 'LONG_TERM') {
      return NextResponse.json({ error: 'taskType должен быть QUICK или LONG_TERM' }, { status: 400 })
    }
    if (task.report) {
      return NextResponse.json({ error: 'Нельзя менять формат задачи с отчётом' }, { status: 400 })
    }
    if (parseDelegationParentTaskId(task.comment)) {
      return NextResponse.json({ error: 'Нельзя менять формат распределённой дочерней задачи' }, { status: 400 })
    }
    if (role !== 'ADMIN' && role !== 'CHIEF_ENGINEER') {
      return NextResponse.json({ error: 'Формат задачи задаёт только главный инженер' }, { status: 403 })
    }
    if (role === 'CHIEF_ENGINEER') {
      const ok =
        task.assignedToId === session.user.id ||
        (task.managedByChiefId !== null && task.managedByChiefId === session.user.id)
      if (!ok) {
        return NextResponse.json({ error: 'Нет прав менять формат этой задачи' }, { status: 403 })
      }
    }
    if (tt === 'QUICK' && task.taskType === 'LONG_TERM') {
      const dwCount = await db.dailyWork.count({ where: { taskId: task.id } })
      if (dwCount > 0) {
        return NextResponse.json(
          { error: 'Уже есть записи дневника — нельзя вернуть формат «быстрая»' },
          { status: 400 }
        )
      }
    }
    nextTaskType = tt
    if (tt === 'LONG_TERM') {
      nextManagedByChiefId =
        role === 'CHIEF_ENGINEER'
          ? task.managedByChiefId ?? session.user.id
          : task.managedByChiefId ?? task.assignedToId
    } else {
      nextManagedByChiefId = null
    }
  }

  let nextScheduledAt: Date | null | undefined
  if (hasScheduled) {
    if (role !== 'ADMIN' && role !== 'CHIEF_ENGINEER') {
      return NextResponse.json({ error: 'Нет прав на изменение срока' }, { status: 403 })
    }
    if (role === 'CHIEF_ENGINEER') {
      const own = task.assignedToId === session.user.id
      const subtree = await chiefOwnsDelegationParent(task, session.user.id)
      if (!own && !subtree) {
        return NextResponse.json({ error: 'Нет прав на изменение срока' }, { status: 403 })
      }
    }

    if (body.scheduledAt === null || body.scheduledAt === undefined || body.scheduledAt === '') {
      nextScheduledAt = null
    } else {
      const d = new Date(body.scheduledAt)
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: 'Некорректная дата' }, { status: 400 })
      }
      nextScheduledAt = d
    }
  }

  let newEngineerId: string | undefined
  let parentForNotify: { assignedToId: string | null } | null = null

  if (hasAssignee) {
    if (role !== 'ADMIN' && role !== 'CHIEF_ENGINEER') {
      return NextResponse.json({ error: 'Нет прав на переназначение' }, { status: 403 })
    }
    if (task.report) {
      return NextResponse.json({ error: 'Нельзя переназначить задачу с отчётом' }, { status: 400 })
    }

    const rawId = body.assignedToId
    if (rawId === null || rawId === undefined || rawId === '') {
      return NextResponse.json({ error: 'Укажите инженера' }, { status: 400 })
    }

    const engineer = await db.user.findFirst({
      where: { id: rawId, role: 'ENGINEER', isActive: true },
      select: { id: true, name: true },
    })
    if (!engineer) {
      return NextResponse.json({ error: 'Инженер не найден' }, { status: 400 })
    }

    if (task.taskType === 'LONG_TERM') {
      const chiefOk =
        role === 'CHIEF_ENGINEER' && task.managedByChiefId && task.managedByChiefId === session.user.id
      if (role !== 'ADMIN' && !chiefOk) {
        return NextResponse.json({ error: 'Нет прав на переназначение по этой задаче' }, { status: 403 })
      }
      newEngineerId = engineer.id
      parentForNotify = null
    } else {
      const parentId = parseDelegationParentTaskId(task.comment)
      if (!parentId) {
        return NextResponse.json({ error: 'Переназначение доступно только для распределённых задач' }, { status: 400 })
      }

      const parent = await db.serviceTask.findUnique({
        where: { id: parentId },
        select: { id: true, assignedToId: true, deletedAt: true },
      })
      if (!parent || parent.deletedAt) {
        return NextResponse.json({ error: 'Родительская задача не найдена' }, { status: 400 })
      }

      const chiefOk = role === 'CHIEF_ENGINEER' && parent.assignedToId === session.user.id
      if (role !== 'ADMIN' && !chiefOk) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const marker = `[Распределено ГИ из задачи ${parentId}]`
      const siblings = await db.serviceTask.findMany({
        where: {
          id: { not: params.id },
          deletedAt: null,
          comment: { contains: marker },
        },
        select: { id: true, assignedToId: true, comment: true },
      })
      const siblingSameEngineer = siblings.some(
        (s) =>
          parseDelegationParentTaskId(s.comment) === parentId && s.assignedToId === engineer.id
      )
      if (siblingSameEngineer) {
        return NextResponse.json(
          { error: 'Этот инженер уже назначен на другую задачу по этой заявке' },
          { status: 400 }
        )
      }

      newEngineerId = engineer.id
      parentForNotify = parent
    }
  }

  const previousAssigneeId = task.assignedToId
  const data: {
    scheduledAt?: Date | null
    assignedToId?: string
    taskType?: TaskWorkType
    managedByChiefId?: string | null
  } = {}
  if (hasScheduled) data.scheduledAt = nextScheduledAt!
  if (hasAssignee) data.assignedToId = newEngineerId!
  if (hasTaskType) {
    data.taskType = nextTaskType!
    data.managedByChiefId = nextManagedByChiefId ?? null
  }

  const updated = await db.serviceTask.update({
    where: { id: params.id },
    data,
  })

  if (hasAssignee && task.taskType === 'LONG_TERM' && newEngineerId) {
    await db.longTermTaskEngineer.deleteMany({ where: { taskId: params.id } })
    await db.longTermTaskEngineer.create({
      data: { taskId: params.id, engineerId: newEngineerId },
    })
  }

  if (hasAssignee && previousAssigneeId && previousAssigneeId !== newEngineerId) {
    await syncEngineerFreeIfNoActiveTasks(previousAssigneeId)
  }
  if (hasAssignee && newEngineerId && previousAssigneeId !== newEngineerId) {
    await markEngineerBusy(newEngineerId)
    const chiefId =
      parentForNotify?.assignedToId ||
      (task.taskType === 'LONG_TERM' ? task.managedByChiefId : null)
    const chief =
      chiefId &&
      (await db.user.findUnique({
        where: { id: chiefId },
        select: { id: true, name: true },
      }))
    if (chief) {
      await notifyTaskAssigned(
        {
          id: updated.id,
          type: updated.type,
          priority: updated.priority,
          comment: updated.comment,
        },
        { id: newEngineerId },
        chief
      )
    }
  }

  return NextResponse.json({
    ok: true,
    task: {
      id: updated.id,
      scheduledAt: updated.scheduledAt,
      assignedToId: updated.assignedToId,
      taskType: updated.taskType,
      managedByChiefId: updated.managedByChiefId,
    },
  })
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Только администратор может удалять задачи' }, { status: 403 })
  }

  const task = await db.serviceTask.findUnique({
    where: { id: params.id },
    select: { id: true, status: true, assignedToId: true, deletedAt: true, report: { select: { id: true } } },
  })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (task.deletedAt) {
    return NextResponse.json({ error: 'Задача уже находится в корзине' }, { status: 400 })
  }
  if (task.report) {
    return NextResponse.json(
      { error: 'Нельзя удалить задачу с уже созданным отчётом' },
      { status: 400 }
    )
  }

  await db.serviceTask.update({
    where: { id: params.id },
    data: {
      deletedAt: new Date(),
      deletedById: session.user.id,
      deletedStatus: task.status,
      status: 'CANCELLED',
    },
  })
  if (task.assignedToId) {
    await syncEngineerFreeIfNoActiveTasks(task.assignedToId)
  }
  return NextResponse.json({ ok: true })
}

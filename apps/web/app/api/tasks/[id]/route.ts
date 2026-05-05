import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { syncEngineerFreeIfNoActiveTasks, markEngineerBusy } from '@/lib/engineerPresence'
import { parseDelegationParentTaskId } from '@/lib/task-delegation'
import {
  notifyEngineerRemovedFromTask,
  notifyLongTermEndDateChanged,
  notifyLongTermEngineerAssigned,
  notifyTaskAssigned,
} from '@/lib/notifications'
import { formatDateRu, formatLongTermNotifyPeriod } from '@/lib/task-schedule-display'
import type { Role, TaskWorkType } from '@prisma/client'

function utcDateOnlyFromDate(d: Date): Date {
  const x = new Date(d)
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()))
}

function parseBodyDateOnly(v: unknown): Date | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v !== 'string') return null
  const raw = v.length <= 10 ? `${v}T12:00:00.000Z` : v
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : utcDateOnlyFromDate(d)
}

function canEditLongTermPlanDates(
  role: Role,
  userId: string,
  task: { taskType: TaskWorkType; managedByChiefId: string | null; assignedToId: string | null }
): boolean {
  if (task.taskType !== 'LONG_TERM') return false
  if (role === 'ADMIN') return true
  if (role === 'CHIEF_ENGINEER') {
    if (task.managedByChiefId === userId) return true
    if (!task.managedByChiefId && task.assignedToId === userId) return true
    return false
  }
  return false
}

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
    startDate?: string | null
    endDate?: string | null
  } | null
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 })
  }

  const hasScheduled = 'scheduledAt' in body
  const hasAssignee = 'assignedToId' in body
  const hasTaskType = 'taskType' in body
  const hasLtDates = 'startDate' in body || 'endDate' in body
  if (!hasScheduled && !hasAssignee && !hasTaskType && !hasLtDates) {
    return NextResponse.json(
      { error: 'Укажите scheduledAt, assignedToId, taskType, startDate или endDate' },
      { status: 400 }
    )
  }

  const role = session.user.role as Role
  const task = await db.serviceTask.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      requestNumber: true,
      deletedAt: true,
      status: true,
      taskType: true,
      assignedToId: true,
      managedByChiefId: true,
      comment: true,
      scheduledAt: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      type: true,
      priority: true,
      report: { select: { id: true } },
    },
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
    if (task.taskType === 'LONG_TERM') {
      return NextResponse.json(
        {
          error:
            'Для долгосрочной задачи укажите даты начала и окончания (поля «Дата начала» и «Дата окончания»), а не общий срок',
        },
        { status: 400 }
      )
    }
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

  let nextStartDate: Date | null | undefined
  let nextEndDate: Date | null | undefined
  if (hasLtDates) {
    if (task.taskType !== 'LONG_TERM') {
      return NextResponse.json(
        { error: 'Даты начала и окончания задаются только для долгосрочной задачи' },
        { status: 400 }
      )
    }
    if (!canEditLongTermPlanDates(role, session.user.id, task)) {
      return NextResponse.json({ error: 'Нет прав на изменение дат плана' }, { status: 403 })
    }
    if ('startDate' in body) {
      const p = parseBodyDateOnly(body.startDate)
      if (body.startDate !== null && body.startDate !== undefined && body.startDate !== '' && p === null) {
        return NextResponse.json({ error: 'Некорректная дата начала' }, { status: 400 })
      }
      nextStartDate = p
    }
    if ('endDate' in body) {
      const p = parseBodyDateOnly(body.endDate)
      if (body.endDate !== null && body.endDate !== undefined && body.endDate !== '' && p === null) {
        return NextResponse.json({ error: 'Некорректная дата окончания' }, { status: 400 })
      }
      nextEndDate = p
    }
    const effectiveStart = nextStartDate !== undefined ? nextStartDate : task.startDate
    const effectiveEnd = nextEndDate !== undefined ? nextEndDate : task.endDate
    if (effectiveStart && effectiveEnd && effectiveStart.getTime() > effectiveEnd.getTime()) {
      return NextResponse.json(
        { error: 'Дата начала не может быть позже даты окончания' },
        { status: 400 }
      )
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
        select: { id: true, status: true, assignedToId: true, comment: true },
      })
      const siblingSameEngineer = siblings.some(
        (s) =>
          parseDelegationParentTaskId(s.comment) === parentId &&
          !['DONE', 'CANCELLED'].includes(s.status) &&
          s.assignedToId === engineer.id
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
    assignedAt?: Date | null
    taskType?: TaskWorkType
    managedByChiefId?: string | null
    startDate?: Date | null
    endDate?: Date | null
  } = {}
  if (hasScheduled) data.scheduledAt = nextScheduledAt!
  if (hasAssignee) data.assignedToId = newEngineerId!
  if (hasAssignee) data.assignedAt = new Date()
  if (hasTaskType) {
    data.taskType = nextTaskType!
    data.managedByChiefId = nextManagedByChiefId ?? null
    if (nextTaskType === 'QUICK') {
      data.startDate = null
      data.endDate = null
    }
    if (nextTaskType === 'QUICK' && task.taskType === 'LONG_TERM') {
      if (role === 'CHIEF_ENGINEER') {
        data.assignedToId = task.managedByChiefId ?? session.user.id
      } else {
        const nextAssignee = task.managedByChiefId ?? task.assignedToId
        if (nextAssignee) data.assignedToId = nextAssignee
      }
    }
    if (nextTaskType === 'LONG_TERM' && task.taskType !== 'LONG_TERM') {
      if (!task.startDate) {
        data.startDate = utcDateOnlyFromDate(task.createdAt)
      }
      if (!task.endDate && task.scheduledAt) {
        data.endDate = utcDateOnlyFromDate(task.scheduledAt)
      }
    }
  }
  if (hasLtDates) {
    if (nextStartDate !== undefined) data.startDate = nextStartDate
    if (nextEndDate !== undefined) data.endDate = nextEndDate
  }

  if (hasTaskType && nextTaskType === 'QUICK' && task.taskType === 'LONG_TERM') {
    await db.longTermTaskEngineer.deleteMany({ where: { taskId: params.id } })
  }

  const updated = await db.serviceTask.update({
    where: { id: params.id },
    data,
  })

  if (
    hasTaskType &&
    nextTaskType === 'QUICK' &&
    task.taskType === 'LONG_TERM' &&
    previousAssigneeId &&
    updated.assignedToId &&
    previousAssigneeId !== updated.assignedToId
  ) {
    await syncEngineerFreeIfNoActiveTasks(previousAssigneeId)
    await markEngineerBusy(updated.assignedToId)
  }

  if (hasAssignee && task.taskType === 'LONG_TERM' && newEngineerId) {
    await db.longTermTaskEngineer.deleteMany({ where: { taskId: params.id } })
    await db.longTermTaskEngineer.create({
      data: { taskId: params.id, engineerId: newEngineerId },
    })
  }

  if (hasAssignee && previousAssigneeId && previousAssigneeId !== newEngineerId) {
    await syncEngineerFreeIfNoActiveTasks(previousAssigneeId)
    await notifyEngineerRemovedFromTask(updated.id, task.requestNumber, previousAssigneeId)
  }
  if (hasAssignee && newEngineerId && previousAssigneeId !== newEngineerId) {
    await markEngineerBusy(newEngineerId)
    if (task.taskType === 'LONG_TERM') {
      const period = formatLongTermNotifyPeriod(updated.startDate, updated.endDate).trim()
      await notifyLongTermEngineerAssigned(updated.id, task.requestNumber, newEngineerId, period)
    } else {
      const chiefId = parentForNotify?.assignedToId
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
  }

  if (hasLtDates && 'endDate' in body && task.taskType === 'LONG_TERM') {
    const prevMs = task.endDate ? task.endDate.getTime() : null
    const nextMs = updated.endDate ? updated.endDate.getTime() : null
    if (prevMs !== nextMs) {
      const rows = await db.longTermTaskEngineer.findMany({
        where: { taskId: params.id },
        select: { engineerId: true },
      })
      const notifyIds = [...rows.map((r) => r.engineerId)]
      if (updated.assignedToId) notifyIds.push(updated.assignedToId)
      const label = updated.endDate ? formatDateRu(new Date(updated.endDate)) : '—'
      await notifyLongTermEndDateChanged(updated.id, task.requestNumber, notifyIds, label)
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
      startDate: updated.startDate,
      endDate: updated.endDate,
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

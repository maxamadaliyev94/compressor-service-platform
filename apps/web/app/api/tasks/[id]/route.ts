import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
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
import { logUserActivity, UserActivityAction } from '@/lib/user-activity-log'
import type { Role, TaskPriority, TaskWorkType } from '@prisma/client'
import { assertActiveWorkTypeCode } from '@/lib/work-types'

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
  if (role === 'ADMIN' || role === 'MANAGER') return true
  if (role === 'CHIEF_ENGINEER') {
    if (task.managedByChiefId === userId) return true
    if (!task.managedByChiefId && task.assignedToId === userId) return true
    return false
  }
  return false
}

function canManagerEditActiveTask(role: Role): boolean {
  return role === 'ADMIN' || role === 'MANAGER'
}

/** ГИ владеет родительской заявкой для этой дочерней распределённой задачи. */
async function chiefOwnsDelegationParent(task: { comment: string | null }, chiefUserId: string): Promise<boolean> {
  const parentId = parseDelegationParentTaskId(task.comment)
  if (!parentId) return false
  const parent = await db.serviceTask.findUnique({
    where: { id: parentId },
    select: { assignedToId: true, managedByChiefId: true, deletedAt: true },
  })
  return Boolean(
    parent &&
      !parent.deletedAt &&
      (parent.assignedToId === chiefUserId || parent.managedByChiefId === chiefUserId)
  )
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
    equipmentId?: string
    type?: string
    priority?: TaskPriority
    comment?: string | null
  } | null
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 })
  }

  const hasScheduled = 'scheduledAt' in body
  const hasAssignee = 'assignedToId' in body
  const hasTaskType = 'taskType' in body
  const hasLtDates = 'startDate' in body || 'endDate' in body
  const hasEquipment = 'equipmentId' in body
  const hasWorkType = 'type' in body
  const hasPriority = 'priority' in body
  const hasComment = 'comment' in body
  if (
    !hasScheduled &&
    !hasAssignee &&
    !hasTaskType &&
    !hasLtDates &&
    !hasEquipment &&
    !hasWorkType &&
    !hasPriority &&
    !hasComment
  ) {
    return NextResponse.json({ error: 'Нет полей для обновления' }, { status: 400 })
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
    if (role !== 'ADMIN' && role !== 'MANAGER' && role !== 'CHIEF_ENGINEER') {
      return NextResponse.json({ error: 'Нет прав на изменение срока' }, { status: 403 })
    }
    if (role === 'CHIEF_ENGINEER') {
      const subtree = await chiefOwnsDelegationParent(task, session.user.id)
      const allowed =
        task.assignedToId === session.user.id ||
        task.managedByChiefId === session.user.id ||
        subtree
      if (!allowed) {
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
  let managerChiefReassign = false

  if (hasAssignee) {
    if (role !== 'ADMIN' && role !== 'MANAGER' && role !== 'CHIEF_ENGINEER') {
      return NextResponse.json({ error: 'Нет прав на переназначение' }, { status: 403 })
    }
    if (task.report) {
      return NextResponse.json({ error: 'Нельзя переназначить задачу с отчётом' }, { status: 400 })
    }

    const rawId = body.assignedToId
    if (rawId === null || rawId === undefined || rawId === '') {
      return NextResponse.json({ error: 'Укажите инженера' }, { status: 400 })
    }

    const delegationParentId = parseDelegationParentTaskId(task.comment)

    if (canManagerEditActiveTask(role) && !delegationParentId) {
      const chief = await db.user.findFirst({
        where: { id: rawId, role: 'CHIEF_ENGINEER', isActive: true },
        select: { id: true, name: true },
      })
      if (!chief) {
        return NextResponse.json({ error: 'Главный инженер не найден' }, { status: 400 })
      }
      newEngineerId = chief.id
      managerChiefReassign = true
      parentForNotify = null
    } else {
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
  }

  const previousAssigneeId = task.assignedToId
  const data: {
    scheduledAt?: Date | null
    assignedToId?: string
    taskType?: TaskWorkType
    managedByChiefId?: string | null
    startDate?: Date | null
    endDate?: Date | null
    equipmentId?: string
    type?: string
    priority?: TaskPriority
    comment?: string | null
    status?: typeof task.status
  } = {}

  if (hasEquipment || hasWorkType || hasPriority || hasComment) {
    if (!canManagerEditActiveTask(role)) {
      return NextResponse.json({ error: 'Нет прав на изменение задачи' }, { status: 403 })
    }
    if (hasEquipment) {
      const equipmentId = typeof body.equipmentId === 'string' ? body.equipmentId.trim() : ''
      if (!equipmentId) {
        return NextResponse.json({ error: 'Укажите оборудование' }, { status: 400 })
      }
      const eq = await db.equipment.findUnique({ where: { id: equipmentId }, select: { id: true } })
      if (!eq) return NextResponse.json({ error: 'Оборудование не найдено' }, { status: 400 })
      data.equipmentId = equipmentId
    }
    if (hasWorkType) {
      const workType = typeof body.type === 'string' ? body.type.trim() : ''
      if (!workType || !(await assertActiveWorkTypeCode(workType))) {
        return NextResponse.json({ error: 'Неизвестный тип работы' }, { status: 400 })
      }
      data.type = workType
    }
    if (hasPriority) {
      const p = body.priority
      if (!p || !['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'].includes(p)) {
        return NextResponse.json({ error: 'Некорректный приоритет' }, { status: 400 })
      }
      data.priority = p
    }
    if (hasComment) {
      data.comment =
        typeof body.comment === 'string'
          ? body.comment.trim() || null
          : body.comment === null
            ? null
            : undefined
    }
  }
  if (hasScheduled) data.scheduledAt = nextScheduledAt!
  if (hasAssignee) {
    data.assignedToId = newEngineerId!
    if (managerChiefReassign) {
      data.managedByChiefId = null
      if (task.status === 'NEW') data.status = 'ASSIGNED'
    }
  }
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
    hasScheduled &&
    task.taskType === 'QUICK' &&
    !parseDelegationParentTaskId(task.comment)
  ) {
    const marker = `[Распределено ГИ из задачи ${task.id}]`
    const possibleChildren = await db.serviceTask.findMany({
      where: {
        deletedAt: null,
        comment: { contains: marker },
        status: { notIn: ['DONE', 'CANCELLED'] },
      },
      select: { id: true, comment: true },
    })
    const childIds = possibleChildren
      .filter((row) => parseDelegationParentTaskId(row.comment) === task.id)
      .map((row) => row.id)
    if (childIds.length > 0) {
      await db.serviceTask.updateMany({
        where: { id: { in: childIds } },
        data: { scheduledAt: updated.scheduledAt ?? null },
      })
    }
  }

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

  if (hasAssignee && managerChiefReassign && newEngineerId && previousAssigneeId !== newEngineerId) {
    if (previousAssigneeId) await syncEngineerFreeIfNoActiveTasks(previousAssigneeId)
    await markEngineerBusy(newEngineerId)
    const chiefUser = await db.user.findUnique({
      where: { id: newEngineerId },
      select: { id: true, name: true },
    })
    const creator = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true },
    })
    if (chiefUser && creator) {
      await notifyTaskAssigned(
        {
          id: updated.id,
          type: updated.type,
          priority: updated.priority,
          comment: updated.comment,
        },
        chiefUser,
        creator
      )
    }
  }

  if (hasAssignee && task.taskType === 'LONG_TERM' && newEngineerId && !managerChiefReassign) {
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

  await logUserActivity(session.user.id, UserActivityAction.TASK_EDIT, req, {
    page: `/tasks/${params.id}`,
    metadata: { taskId: params.id },
  })

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

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Только администратор может удалять задачи' }, { status: 403 })
  }

  const task = await db.serviceTask.findUnique({
    where: { id: params.id },
    select: { id: true, status: true, assignedToId: true, deletedAt: true, equipmentId: true },
  })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (task.deletedAt) {
    return NextResponse.json({ error: 'Задача уже находится в корзине' }, { status: 400 })
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

  revalidatePath('/tasks')
  revalidatePath('/tasks/kanban')
  revalidatePath('/equipment')
  revalidatePath(`/equipment/${task.equipmentId}`)

  if (task.assignedToId) {
    await syncEngineerFreeIfNoActiveTasks(task.assignedToId)
  }
  const lteRows = await db.longTermTaskEngineer.findMany({
    where: { taskId: params.id },
    select: { engineerId: true },
  })
  for (const r of lteRows) {
    await syncEngineerFreeIfNoActiveTasks(r.engineerId)
  }
  await logUserActivity(session.user.id, UserActivityAction.TASK_DELETE, req, {
    page: `/tasks/${params.id}`,
    metadata: { taskId: params.id },
  })
  return NextResponse.json({ ok: true })
}

import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { logUserActivity, UserActivityAction } from '@/lib/user-activity-log'
import { notifyClientSubscriberForEquipmentWork, notifyTaskAssigned } from '@/lib/notifications'
import { hasPermission } from '@/lib/permissions'
import { markEngineerBusy } from '@/lib/engineerPresence'
import type { Role } from '@prisma/client'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const role = session.user.role as Role

  const canCreate = await hasPermission(role, 'action:task.create')
  if (!canCreate) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const assignedToIds = Array.isArray(body.assignedToIds)
    ? [...new Set(body.assignedToIds.filter((id: unknown): id is string => typeof id === 'string' && !!id))]
    : []
  const hasAssignment = !!body.assignedToId || assignedToIds.length > 0

  if (hasAssignment) {
    const canAssign = await hasPermission(role, 'action:task.assign')
    if (!canAssign) {
      return NextResponse.json({ error: 'Нет прав на назначение задачи' }, { status: 403 })
    }
  }

  if ((role === 'ADMIN' || role === 'MANAGER') && assignedToIds.length > 0) {
    return NextResponse.json(
      { error: 'Администратор и менеджер назначают задачи только главному инженеру' },
      { status: 400 }
    )
  }

  const targetIds = role === 'CHIEF_ENGINEER'
    ? assignedToIds.length > 0
      ? assignedToIds
      : body.assignedToId
        ? [body.assignedToId]
        : []
    : body.assignedToId
      ? [body.assignedToId]
      : []

  if ((role === 'ADMIN' || role === 'MANAGER') && targetIds.length === 0) {
    return NextResponse.json({ error: 'Выберите главного инженера' }, { status: 400 })
  }

  if (role === 'CHIEF_ENGINEER' && targetIds.length > 0) {
    const hasScheduledAt = typeof body.scheduledAt === 'string' && body.scheduledAt.trim().length > 0
    if (!hasScheduledAt) {
      return NextResponse.json(
        { error: 'Главный инженер может назначать инженеров только после указания срока выполнения' },
        { status: 400 }
      )
    }
  }

  const [creator, selectedEquipment, assignees] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, isActive: true },
    }),
    db.equipment.findUnique({
      where: { id: body.equipmentId },
      select: { id: true },
    }),
    targetIds.length > 0
      ? db.user.findMany({
          where: { id: { in: targetIds } },
          select: { id: true, role: true, isActive: true },
        })
      : Promise.resolve(null),
  ])

  if (!creator || !creator.isActive) {
    return NextResponse.json(
      { error: 'Пользователь сессии не найден. Перезайдите в систему.' },
      { status: 401 }
    )
  }
  if (!selectedEquipment) {
    return NextResponse.json({ error: 'Оборудование не найдено' }, { status: 400 })
  }
  if (targetIds.length > 0) {
    const assigneeList = assignees ?? []
    if (assigneeList.length !== targetIds.length || assigneeList.some((user) => !user.isActive)) {
      return NextResponse.json({ error: 'Один или несколько назначенных пользователей недоступны' }, { status: 400 })
    }
    if ((role === 'ADMIN' || role === 'MANAGER') && assigneeList.some((user) => user.role !== 'CHIEF_ENGINEER')) {
      return NextResponse.json({ error: 'Можно назначать только главному инженеру' }, { status: 400 })
    }
    if (role === 'CHIEF_ENGINEER' && assigneeList.some((user) => user.role !== 'ENGINEER')) {
      return NextResponse.json({ error: 'Главный инженер может назначать только инженерам' }, { status: 400 })
    }
  }

  /** Формат «быстрая / долгосрочная» задаёт только главный инженер на странице задачи, не при создании. */
  const taskType = 'QUICK' as const

  const createdByUser = await db.user.findUnique({ where: { id: creator.id } })
  const createdTasks = []
  const maxRequest = await db.serviceTask.aggregate({ _max: { requestNumber: true } })
  const nextRequestNumber = (maxRequest._max.requestNumber ?? 0) + 1

  if (targetIds.length === 0) {
    const task = await db.serviceTask.create({
      data: {
        requestNumber: nextRequestNumber,
        equipmentId: body.equipmentId,
        createdById: creator.id,
        assignedToId: null,
        type: body.type,
        taskType,
        managedByChiefId: null,
        priority: body.priority || 'MEDIUM',
        status: 'NEW',
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        comment: body.comment || null,
      },
    })
    createdTasks.push(task)
  } else if (targetIds.length === 1) {
    const assigneeId = targetIds[0]
    const task = await db.serviceTask.create({
      data: {
        requestNumber: nextRequestNumber,
        equipmentId: body.equipmentId,
        createdById: creator.id,
        assignedToId: assigneeId,
        type: body.type,
        taskType,
        managedByChiefId: null,
        priority: body.priority || 'MEDIUM',
        status: 'ASSIGNED',
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        comment: body.comment || null,
      },
    })
    createdTasks.push(task)
    await markEngineerBusy(assigneeId)
    const assignedUser = assignees?.find((user) => user.id === assigneeId)
    if (assignedUser && createdByUser) {
      await notifyTaskAssigned(task, assignedUser, createdByUser)
    }
  } else {
    /** Несколько инженеров: одна заявка, соисполнители в long_term_task_engineers, один акт при закрытии. */
    const managedByChiefId = role === 'CHIEF_ENGINEER' ? creator.id : null
    const task = await db.serviceTask.create({
      data: {
        requestNumber: nextRequestNumber,
        equipmentId: body.equipmentId,
        createdById: creator.id,
        assignedToId: null,
        type: body.type,
        taskType,
        managedByChiefId,
        priority: body.priority || 'MEDIUM',
        status: 'ASSIGNED',
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        comment: body.comment || null,
        longTermEngineers: {
          create: targetIds.map((engineerId) => ({ engineerId, participationStatus: 'ASSIGNED' as const })),
        },
      },
    })
    createdTasks.push(task)
    for (const assigneeId of targetIds) {
      await markEngineerBusy(assigneeId)
      const assignedUser = assignees?.find((user) => user.id === assigneeId)
      if (assignedUser && createdByUser) {
        await notifyTaskAssigned(task, assignedUser, createdByUser)
      }
    }
  }

  if (createdTasks.length > 0) {
    await logUserActivity(creator.id, UserActivityAction.TASK_CREATE, req, {
      page: '/tasks',
      metadata: { taskIds: createdTasks.map((t) => t.id), count: createdTasks.length },
    })
    const skipUserIds = [creator.id, ...targetIds]
    const n = createdTasks.length
    await notifyClientSubscriberForEquipmentWork(
      body.equipmentId,
      {
        title: n === 1 ? 'Новая задача по клиенту' : `Новые задачи по клиенту (${n})`,
        message:
          n === 1
            ? 'Создана новая задача на оборудовании клиента.'
            : `Создано задач на оборудовании клиента: ${n}.`,
        type: 'TASK',
        link: `/tasks/${createdTasks[0].id}`,
      },
      { skipUserIds }
    )
  }

  return NextResponse.json({
    ok: true,
    count: createdTasks.length,
    tasks: createdTasks,
  })
}

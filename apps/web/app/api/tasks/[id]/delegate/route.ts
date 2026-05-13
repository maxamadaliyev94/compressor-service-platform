import { db } from '@/lib/db'
import { auth } from '@/auth'
import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { notifyClientSubscriberForEquipmentWork, notifyTaskAssigned } from '@/lib/notifications'
import { markEngineerBusy, syncEngineerFreeIfNoActiveTasks } from '@/lib/engineerPresence'
import { parseDelegationParentTaskId } from '@/lib/task-delegation'
import type { Role } from '@prisma/client'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = session.user.role as Role
  if (!['ADMIN', 'MANAGER', 'CHIEF_ENGINEER'].includes(role)) {
    return NextResponse.json({ error: 'Нет прав на распределение' }, { status: 403 })
  }

  const canAssign = await hasPermission(role, 'action:task.assign')
  if (!canAssign) {
    return NextResponse.json({ error: 'Нет прав на назначение' }, { status: 403 })
  }

  const body = (await req.json()) as { engineerIds?: string[] }
  const engineerIds = Array.isArray(body.engineerIds)
    ? [...new Set(body.engineerIds.filter((id): id is string => typeof id === 'string' && id.length > 0))]
    : []

  if (engineerIds.length === 0) {
    return NextResponse.json({ error: 'Выберите хотя бы одного инженера' }, { status: 400 })
  }

  const task = await db.serviceTask.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      requestNumber: true,
      equipmentId: true,
      assignedToId: true,
      managedByChiefId: true,
      type: true,
      taskType: true,
      priority: true,
      status: true,
      scheduledAt: true,
      comment: true,
      deletedAt: true,
      report: { select: { id: true } },
      longTermEngineers: { select: { engineerId: true } },
      equipment: { select: { object: { select: { branch: { select: { client: { select: { managerId: true } } } } } } } },
    },
  })

  if (!task || task.deletedAt) {
    return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 })
  }
  if (task.report) {
    return NextResponse.json({ error: 'Нельзя распределить задачу с отчётом' }, { status: 400 })
  }
  if (['DONE', 'CANCELLED'].includes(task.status)) {
    return NextResponse.json({ error: 'Задача уже завершена или отменена' }, { status: 400 })
  }
  if (!task.scheduledAt) {
    return NextResponse.json(
      { error: 'Сначала укажите срок выполнения, затем распределяйте инженеров' },
      { status: 400 }
    )
  }
  const canUseTask =
    role === 'ADMIN' ||
    role === 'MANAGER' ||
    (role === 'CHIEF_ENGINEER' &&
      (task.assignedToId === session.user.id ||
        task.managedByChiefId === session.user.id))
  if (!canUseTask) {
    return NextResponse.json({ error: 'Нет прав на распределение этой задачи' }, { status: 403 })
  }

  const assigneeRole =
    task.assignedToId &&
    (await db.user.findUnique({
      where: { id: task.assignedToId },
      select: { role: true },
    }))?.role

  const alreadyOnTask = new Set(task.longTermEngineers.map((r) => r.engineerId))
  if (task.assignedToId && assigneeRole === 'ENGINEER') {
    alreadyOnTask.add(task.assignedToId)
  }
  const newlyPicked = engineerIds.filter((id) => !alreadyOnTask.has(id))
  if (newlyPicked.length === 0) {
    return NextResponse.json(
      { error: 'Все выбранные инженеры уже назначены на эту заявку' },
      { status: 400 }
    )
  }
  for (const id of engineerIds) alreadyOnTask.add(id)
  const mergedEngineerIds = [...alreadyOnTask]

  const engineers = await db.user.findMany({
    where: { id: { in: mergedEngineerIds }, role: 'ENGINEER', isActive: true },
    select: { id: true, name: true },
  })
  if (engineers.length !== mergedEngineerIds.length) {
    return NextResponse.json({ error: 'Некорректный список инженеров' }, { status: 400 })
  }

  const marker = `[Распределено ГИ из задачи ${task.id}]`
  const existingChildren = await db.serviceTask.findMany({
    where: { deletedAt: null, comment: { contains: marker } },
    select: { id: true, status: true, assignedToId: true, comment: true },
  })
  const legacyChildIds = existingChildren
    .filter((c) => parseDelegationParentTaskId(c.comment) === task.id && !['DONE', 'CANCELLED'].includes(c.status))
    .map((c) => c.id)
  const legacyFreedEngineerIds = existingChildren
    .filter((c) => parseDelegationParentTaskId(c.comment) === task.id && !['DONE', 'CANCELLED'].includes(c.status))
    .map((c) => c.assignedToId)
    .filter((id): id is string => Boolean(id))

  const chief = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true },
  })
  if (!chief) {
    return NextResponse.json({ error: 'Пользователь не найден' }, { status: 401 })
  }

  const prevJunctionIds = task.longTermEngineers.map((r) => r.engineerId)
  const prevAssignee = task.assignedToId

  const managedByChiefId =
    role === 'CHIEF_ENGINEER' ? chief.id : task.managedByChiefId ?? null

  await db.$transaction(async (tx) => {
    if (legacyChildIds.length > 0) {
      await tx.serviceTask.updateMany({
        where: { id: { in: legacyChildIds } },
        data: {
          status: 'CANCELLED',
          cancelReason: 'Заменено: единая заявка на родительской задаче',
        },
      })
    }

    await tx.longTermTaskEngineer.deleteMany({ where: { taskId: task.id } })

    if (mergedEngineerIds.length === 1) {
      /** Один исполнитель: задача уходит с ГИ, ГИ только наблюдатель (managedByChiefId). */
      await tx.serviceTask.update({
        where: { id: task.id },
        data: {
          assignedToId: mergedEngineerIds[0],
          managedByChiefId,
          status: 'ASSIGNED',
          cancelReason: null,
        },
      })
    } else {
      await tx.serviceTask.update({
        where: { id: task.id },
        data: {
          assignedToId: null,
          managedByChiefId,
          status: 'ASSIGNED',
          cancelReason: null,
        },
      })
      await tx.longTermTaskEngineer.createMany({
        data: mergedEngineerIds.map((engineerId) => ({
          taskId: task.id,
          engineerId,
          participationStatus: 'ASSIGNED' as const,
        })),
      })
    }
  })

  for (const uid of legacyFreedEngineerIds) {
    await syncEngineerFreeIfNoActiveTasks(uid)
  }
  for (const uid of prevJunctionIds) {
    if (!mergedEngineerIds.includes(uid)) {
      await syncEngineerFreeIfNoActiveTasks(uid)
    }
  }
  if (prevAssignee && !mergedEngineerIds.includes(prevAssignee) && prevAssignee !== managedByChiefId) {
    await syncEngineerFreeIfNoActiveTasks(prevAssignee)
  }

  for (const e of engineers.filter((x) => newlyPicked.includes(x.id))) {
    await markEngineerBusy(e.id)
    await notifyTaskAssigned(
      {
        id: task.id,
        type: task.type,
        priority: task.priority,
        comment: task.comment,
      },
      e,
      chief
    )
  }

  const n = newlyPicked.length
  await notifyClientSubscriberForEquipmentWork(
    task.equipmentId,
    {
      title: n === 1 ? 'Назначен исполнитель по заявке' : `Назначены исполнители по заявке (${n})`,
      message:
        mergedEngineerIds.length === 1
          ? 'Задача передана инженеру для выполнения (один акт).'
          : 'Задача распределена между инженерами (одна заявка, один акт при закрытии).',
      type: 'TASK',
      link: `/tasks/${task.id}`,
    },
    { skipUserIds: newlyPicked }
  )

  return NextResponse.json({ ok: true, taskIds: [task.id] })
}

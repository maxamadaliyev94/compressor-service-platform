import { db } from '@/lib/db'
import { auth } from '@/auth'
import { NextRequest, NextResponse } from 'next/server'
import { hasPermission } from '@/lib/permissions'
import { notifyClientSubscriberForEquipmentWork, notifyTaskAssigned } from '@/lib/notifications'
import { markEngineerBusy } from '@/lib/engineerPresence'
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
      type: true,
      taskType: true,
      priority: true,
      status: true,
      scheduledAt: true,
      comment: true,
      deletedAt: true,
      report: { select: { id: true } },
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
    (role === 'CHIEF_ENGINEER' && task.assignedToId === session.user.id) ||
    role === 'MANAGER'
  if (!canUseTask) {
    return NextResponse.json({ error: 'Нет прав на распределение этой задачи' }, { status: 403 })
  }

  const marker = `[Распределено ГИ из задачи ${task.id}]`
  const existingChildren = await db.serviceTask.findMany({
    where: { deletedAt: null, comment: { contains: marker } },
    select: { id: true, status: true, assignedToId: true, comment: true },
  })
  const mappedChildren = existingChildren.filter((c) => parseDelegationParentTaskId(c.comment) === task.id)
  const activeByEngineer = new Map<string, { id: string; status: string }>()
  const cancelledByEngineer = new Map<string, { id: string; status: string }>()
  for (const c of mappedChildren) {
    if (!c.assignedToId) continue
    if (c.status === 'CANCELLED' || c.status === 'DONE') {
      if (!cancelledByEngineer.has(c.assignedToId)) {
        cancelledByEngineer.set(c.assignedToId, { id: c.id, status: c.status })
      }
      continue
    }
    if (!activeByEngineer.has(c.assignedToId)) {
      activeByEngineer.set(c.assignedToId, { id: c.id, status: c.status })
    }
  }

  const engineers = await db.user.findMany({
    where: { id: { in: engineerIds }, role: 'ENGINEER', isActive: true },
    select: { id: true, name: true },
  })
  if (engineers.length !== engineerIds.length) {
    return NextResponse.json({ error: 'Некорректный список инженеров' }, { status: 400 })
  }

  const toReactivate = engineers
    .filter((e) => !activeByEngineer.has(e.id))
    .map((e) => ({ engineerId: e.id, cancelledTaskId: cancelledByEngineer.get(e.id)?.id ?? null }))
  const engineersToCreate = toReactivate.filter((e) => !e.cancelledTaskId).map((e) => e.engineerId)
  const reactivateTaskIds = toReactivate.filter((e) => !!e.cancelledTaskId).map((e) => e.cancelledTaskId as string)

  if (engineersToCreate.length === 0 && reactivateTaskIds.length === 0) {
    return NextResponse.json(
      { error: 'Все выбранные инженеры уже назначены на эту заявку' },
      { status: 400 }
    )
  }

  const chief = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true },
  })
  if (!chief) {
    return NextResponse.json({ error: 'Пользователь не найден' }, { status: 401 })
  }

  const baseComment = task.comment?.trim() || ''
  const prefix = `${marker}\n`

  const createdIds = await db.$transaction(async (tx) => {
    const ids: string[] = []
    for (const engineerId of engineersToCreate) {
      const alreadyExists = await tx.serviceTask.findFirst({
        where: {
          deletedAt: null,
          assignedToId: engineerId,
          comment: { contains: marker },
          status: { notIn: ['DONE', 'CANCELLED'] },
        },
        select: { id: true, comment: true },
      })
      if (alreadyExists && parseDelegationParentTaskId(alreadyExists.comment) === task.id) {
        ids.push(alreadyExists.id)
        continue
      }
      const created = await tx.serviceTask.create({
        data: {
          requestNumber: task.requestNumber,
          equipmentId: task.equipmentId,
          createdById: chief.id,
          assignedToId: engineerId,
          type: task.type,
          taskType: 'QUICK',
          managedByChiefId: null,
          priority: task.priority,
          status: 'ASSIGNED',
          scheduledAt: task.scheduledAt,
          comment: `${prefix}${baseComment}`.trim(),
        },
      })
      ids.push(created.id)
    }
    for (const reactivateId of reactivateTaskIds) {
      await tx.serviceTask.update({
        where: { id: reactivateId },
        data: { status: 'ASSIGNED', cancelReason: null },
      })
      ids.push(reactivateId)
    }

    await tx.serviceTask.update({
      where: { id: task.id },
      data: {
        status: 'ASSIGNED',
        cancelReason: null,
        assignedToId: role === 'CHIEF_ENGINEER' ? chief.id : task.assignedToId,
      },
    })

    return ids
  })

  const newTasks = await db.serviceTask.findMany({
    where: { id: { in: createdIds } },
    select: { id: true, type: true, priority: true, comment: true, assignedToId: true },
  })

  for (const t of newTasks) {
    if (t.assignedToId) {
      await markEngineerBusy(t.assignedToId)
      const assignedUser = engineers.find((e) => e.id === t.assignedToId)
      if (assignedUser) {
        await notifyTaskAssigned(t, assignedUser, chief)
      }
    }
  }

  const n = createdIds.length
  const newEngineerIds = [...new Set([...engineersToCreate, ...toReactivate.map((e) => e.engineerId)])]
  await notifyClientSubscriberForEquipmentWork(
    task.equipmentId,
    {
      title: n === 1 ? 'Новая задача по клиенту' : `Новые задачи по клиенту (${n})`,
      message:
        n === 1
          ? 'Главный инженер распределил задачу на исполнителя.'
          : `Главный инженер распределил задачи на исполнителей (${n}).`,
      type: 'TASK',
      link: `/tasks/${createdIds[0]}`,
    },
    { skipUserIds: newEngineerIds }
  )

  return NextResponse.json({ ok: true, taskIds: createdIds })
}

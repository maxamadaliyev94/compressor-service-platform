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
  if (role !== 'CHIEF_ENGINEER') {
    return NextResponse.json({ error: 'Только главный инженер может распределять задачи' }, { status: 403 })
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
    include: { report: { select: { id: true } } },
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
  if (task.assignedToId !== session.user.id) {
    return NextResponse.json({ error: 'Эта задача назначена не вам' }, { status: 403 })
  }

  const marker = `[Распределено ГИ из задачи ${task.id}]`
  const existingChildren = await db.serviceTask.findMany({
    where: { deletedAt: null, comment: { contains: marker } },
    select: { assignedToId: true, comment: true },
  })
  const alreadyAssigned = new Set(
    existingChildren
      .filter((c) => parseDelegationParentTaskId(c.comment) === task.id)
      .map((c) => c.assignedToId)
      .filter((id): id is string => Boolean(id))
  )

  const engineers = await db.user.findMany({
    where: { id: { in: engineerIds }, role: 'ENGINEER', isActive: true },
    select: { id: true, name: true },
  })
  if (engineers.length !== engineerIds.length) {
    return NextResponse.json({ error: 'Некорректный список инженеров' }, { status: 400 })
  }

  const engineersToCreate = engineers.filter((e) => !alreadyAssigned.has(e.id))
  if (engineersToCreate.length === 0) {
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
    for (const engineerId of engineersToCreate.map((e) => e.id)) {
      const created = await tx.serviceTask.create({
        data: {
          requestNumber: task.requestNumber,
          equipmentId: task.equipmentId,
          createdById: chief.id,
          assignedToId: engineerId,
          type: task.type,
          priority: task.priority,
          status: 'ASSIGNED',
          scheduledAt: task.scheduledAt,
          comment: `${prefix}${baseComment}`.trim(),
        },
      })
      ids.push(created.id)
    }

    await tx.serviceTask.update({
      where: { id: task.id },
      data: {
        status: 'ASSIGNED',
        cancelReason: null,
        assignedToId: chief.id,
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
  const newEngineerIds = engineersToCreate.map((e) => e.id)
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

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { markEngineerBusy, syncEngineerFreeIfNoActiveTasks } from '@/lib/engineerPresence'
import { notifyTaskAssigned } from '@/lib/notifications'
import type { Role } from '@prisma/client'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = session.user.role as Role
  const body = (await req.json().catch(() => null)) as { engineerIds?: unknown } | null
  if (!body || typeof body !== 'object' || !Array.isArray(body.engineerIds)) {
    return NextResponse.json({ error: 'Укажите engineerIds: string[]' }, { status: 400 })
  }

  const engineerIds = [...new Set(body.engineerIds.filter((id): id is string => typeof id === 'string' && id.length > 0))]

  const task = await db.serviceTask.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      taskType: true,
      status: true,
      deletedAt: true,
      type: true,
      priority: true,
      comment: true,
      managedByChiefId: true,
      assignedToId: true,
      report: { select: { id: true } },
    },
  })
  if (!task || task.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (task.taskType !== 'LONG_TERM') {
    return NextResponse.json({ error: 'Только для долгосрочной задачи' }, { status: 400 })
  }
  if (['DONE', 'CANCELLED'].includes(task.status) || task.report) {
    return NextResponse.json({ error: 'Задача закрыта или с отчётом' }, { status: 400 })
  }

  const chiefOk = role === 'CHIEF_ENGINEER' && task.managedByChiefId === session.user.id
  if (role !== 'ADMIN' && !chiefOk) {
    return NextResponse.json({ error: 'Нет прав на назначение' }, { status: 403 })
  }

  if (engineerIds.length === 0) {
    const prevRows = await db.longTermTaskEngineer.findMany({
      where: { taskId: task.id },
      select: { engineerId: true },
    })
    const toFree = new Set(prevRows.map((r) => r.engineerId))
    if (task.assignedToId) toFree.add(task.assignedToId)

    await db.$transaction([
      db.longTermTaskEngineer.deleteMany({ where: { taskId: task.id } }),
      db.serviceTask.update({
        where: { id: task.id },
        data: { assignedToId: null },
      }),
    ])

    for (const uid of toFree) {
      await syncEngineerFreeIfNoActiveTasks(uid)
    }
    return NextResponse.json({ ok: true, engineerIds: [] })
  }

  const engineers = await db.user.findMany({
    where: { id: { in: engineerIds }, role: 'ENGINEER', isActive: true },
    select: { id: true, name: true },
  })
  const engineerIdOk = new Set(engineers.map((e) => e.id))
  const orderedEngineerIds = engineerIds.filter((id) => engineerIdOk.has(id))

  if (orderedEngineerIds.length === 0 && engineerIds.length > 0) {
    return NextResponse.json(
      {
        error:
          'Ни один из выбранных пользователей не является активным инженером. Назначать можно только инженеров из списка.',
      },
      { status: 400 }
    )
  }

  const engineerIdsNorm = orderedEngineerIds

  const prevRows = await db.longTermTaskEngineer.findMany({
    where: { taskId: task.id },
    select: { engineerId: true },
  })
  const prevFromJunction = new Set(prevRows.map((r) => r.engineerId))
  const oldAssignees = new Set<string>(prevFromJunction)
  if (task.assignedToId) oldAssignees.add(task.assignedToId)

  const newSet = new Set(engineerIdsNorm)

  await db.$transaction(async (tx) => {
    await tx.longTermTaskEngineer.deleteMany({ where: { taskId: task.id } })
    await tx.longTermTaskEngineer.createMany({
      data: engineerIdsNorm.map((engineerId) => ({ taskId: task.id, engineerId })),
    })
    await tx.serviceTask.update({
      where: { id: task.id },
      data: { assignedToId: engineerIdsNorm[0] ?? null },
    })
  })

  for (const uid of oldAssignees) {
    if (!newSet.has(uid)) {
      await syncEngineerFreeIfNoActiveTasks(uid)
    }
  }
  for (const uid of engineerIdsNorm) {
    if (!oldAssignees.has(uid)) {
      await markEngineerBusy(uid)
    }
  }

  const chief =
    task.managedByChiefId &&
    (await db.user.findUnique({
      where: { id: task.managedByChiefId },
      select: { id: true, name: true },
    }))
  if (chief) {
    for (const eng of engineers) {
      if (!oldAssignees.has(eng.id)) {
        await notifyTaskAssigned(
          {
            id: task.id,
            type: task.type,
            priority: task.priority,
            comment: task.comment,
          },
          eng,
          chief
        )
      }
    }
  }

  return NextResponse.json({ ok: true, engineerIds: engineerIdsNorm })
}

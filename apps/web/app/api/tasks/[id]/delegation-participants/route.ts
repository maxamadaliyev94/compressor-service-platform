import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { notifyEngineerRemovedFromTask, notifyTaskAssigned } from '@/lib/notifications'
import { markEngineerBusy, syncEngineerFreeIfNoActiveTasks } from '@/lib/engineerPresence'
import type { Role } from '@prisma/client'

async function assertCanEditDelegation(parentId: string, session: { user: { id: string; role: string } }) {
  const parent = await db.serviceTask.findUnique({
    where: { id: parentId },
    select: {
      id: true,
      deletedAt: true,
      requestNumber: true,
      assignedToId: true,
      managedByChiefId: true,
      status: true,
      report: { select: { id: true } },
      type: true,
      priority: true,
      comment: true,
    },
  })
  if (!parent || parent.deletedAt) return { error: 'Not found' as const }
  if (parent.report || ['DONE', 'CANCELLED'].includes(parent.status)) {
    return { error: 'Задача закрыта или с отчётом' as const }
  }
  const role = session.user.role as Role
  const allowed =
    role === 'ADMIN' ||
    role === 'MANAGER' ||
    (role === 'CHIEF_ENGINEER' &&
      (parent.assignedToId === session.user.id || parent.managedByChiefId === session.user.id))
  if (!allowed) return { error: 'Forbidden' as const }
  return { parent }
}

/** Заменить соисполнителя (строка long_term_task_engineers). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as { participantRowId?: unknown; engineerId?: unknown } | null
  const participantRowId = typeof body?.participantRowId === 'string' ? body.participantRowId : ''
  const engineerId = typeof body?.engineerId === 'string' ? body.engineerId : ''
  if (!participantRowId || !engineerId) {
    return NextResponse.json({ error: 'Укажите participantRowId и engineerId' }, { status: 400 })
  }

  const gate = await assertCanEditDelegation(params.id, session)
  if ('error' in gate) {
    return NextResponse.json(
      { error: gate.error },
      { status: gate.error === 'Forbidden' ? 403 : gate.error === 'Not found' ? 404 : 400 }
    )
  }

  const row = await db.longTermTaskEngineer.findFirst({
    where: { id: participantRowId, taskId: params.id },
    select: { id: true, engineerId: true },
  })
  if (!row) return NextResponse.json({ error: 'Запись не найдена' }, { status: 404 })

  const engineer = await db.user.findFirst({
    where: { id: engineerId, role: 'ENGINEER', isActive: true },
    select: { id: true, name: true },
  })
  if (!engineer) return NextResponse.json({ error: 'Инженер не найден' }, { status: 400 })

  const dup = await db.longTermTaskEngineer.findFirst({
    where: { taskId: params.id, engineerId, id: { not: row.id } },
    select: { id: true },
  })
  if (dup) {
    return NextResponse.json({ error: 'Этот инженер уже назначен на заявку' }, { status: 400 })
  }

  const prevEngineerId = row.engineerId
  await db.longTermTaskEngineer.update({
    where: { id: row.id },
    data: { engineerId, participationStatus: 'ASSIGNED' },
  })

  if (prevEngineerId !== engineerId) {
    await syncEngineerFreeIfNoActiveTasks(prevEngineerId)
    await notifyEngineerRemovedFromTask(params.id, gate.parent.requestNumber, prevEngineerId)
    await markEngineerBusy(engineerId)
    const chief = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true },
    })
    if (chief) {
      await notifyTaskAssigned(
        {
          id: params.id,
          type: gate.parent.type,
          priority: gate.parent.priority,
          comment: gate.parent.comment,
        },
        engineer,
        chief
      )
    }
  }

  return NextResponse.json({ ok: true })
}

/** Снять соисполнителя (строка junction). */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rowId = req.nextUrl.searchParams.get('participantRowId') || ''
  if (!rowId) {
    return NextResponse.json({ error: 'Укажите participantRowId в query' }, { status: 400 })
  }

  const gate = await assertCanEditDelegation(params.id, session)
  if ('error' in gate) {
    return NextResponse.json(
      { error: gate.error },
      { status: gate.error === 'Forbidden' ? 403 : gate.error === 'Not found' ? 404 : 400 }
    )
  }

  const remaining = await db.longTermTaskEngineer.count({ where: { taskId: params.id } })
  if (remaining <= 1) {
    return NextResponse.json(
      { error: 'Нельзя снять последнего соисполнителя — отмените заявку или замените инженера' },
      { status: 400 }
    )
  }

  const row = await db.longTermTaskEngineer.findFirst({
    where: { id: rowId, taskId: params.id },
    select: { engineerId: true },
  })
  if (!row) return NextResponse.json({ error: 'Запись не найдена' }, { status: 404 })

  await db.longTermTaskEngineer.delete({ where: { id: rowId } })
  await syncEngineerFreeIfNoActiveTasks(row.engineerId)
  await notifyEngineerRemovedFromTask(params.id, gate.parent.requestNumber, row.engineerId)

  return NextResponse.json({ ok: true })
}

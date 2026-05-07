import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { syncEngineerFreeIfNoActiveTasks } from '@/lib/engineerPresence'

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Только администратор может очищать историю обслуживания' }, { status: 403 })
  }

  const equipment = await db.equipment.findUnique({
    where: { id: params.id },
    select: { id: true },
  })
  if (!equipment) {
    return NextResponse.json({ error: 'Оборудование не найдено' }, { status: 404 })
  }

  const activeAssignments = await db.serviceTask.findMany({
    where: {
      equipmentId: params.id,
      deletedAt: null,
      assignedToId: { not: null },
      status: { notIn: ['DONE', 'CANCELLED'] },
    },
    select: { assignedToId: true },
  })
  const engineerIds = [...new Set(activeAssignments.map((row) => row.assignedToId).filter(Boolean))] as string[]

  const now = new Date()
  const result = await db.serviceTask.updateMany({
    where: { equipmentId: params.id, deletedAt: null },
    data: {
      deletedAt: now,
      deletedById: session.user.id,
    },
  })

  if (engineerIds.length > 0) {
    await Promise.all(engineerIds.map((id) => syncEngineerFreeIfNoActiveTasks(id)))
  }

  return NextResponse.json({ ok: true, cleared: result.count })
}
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { canReadEquipment, type AuthedSession } from '@/lib/api-access'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!['ADMIN', 'CHIEF_ENGINEER'].includes(session.user.role)) {
    const ok = await canReadEquipment(session as AuthedSession, params.id)
    if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const logs = await db.auditLog.findMany({
    where: {
      entity: 'Equipment',
      entityId: params.id,
    },
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: { name: true, role: true },
      },
    },
    take: 100,
  })

  return NextResponse.json(logs)
}

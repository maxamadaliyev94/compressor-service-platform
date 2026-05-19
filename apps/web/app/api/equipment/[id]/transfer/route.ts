import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { canReadClientScope, getEquipmentClientId, type AuthedSession } from '@/lib/api-access'
import { logUserActivity, UserActivityAction } from '@/lib/user-activity-log'

async function resolveTargetObjectId(branchId: string, branchName: string, objectId?: string) {
  if (objectId) {
    const obj = await db.object.findFirst({ where: { id: objectId, branchId } })
    if (!obj) return null
    return obj.id
  }

  const existing = await db.object.findFirst({
    where: { branchId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (existing) return existing.id

  const created = await db.object.create({
    data: { branchId, name: branchName || 'Основной цех' },
    select: { id: true },
  })
  return created.id
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = session.user.role
  if (!['ADMIN', 'MANAGER'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const branchId = typeof body.branchId === 'string' ? body.branchId.trim() : ''
  if (!branchId) return NextResponse.json({ error: 'Выберите филиал назначения' }, { status: 400 })

  const equipment = await db.equipment.findUnique({
    where: { id: params.id },
    include: {
      object: {
        include: {
          branch: { include: { client: { select: { id: true, name: true, managerId: true } } } },
        },
      },
    },
  })
  if (!equipment) return NextResponse.json({ error: 'Оборудование не найдено' }, { status: 404 })

  const sourceClientId = await getEquipmentClientId(params.id)
  if (!sourceClientId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (role === 'MANAGER') {
    const managerId = equipment.object.branch.client.managerId
    if (managerId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const targetBranch = await db.branch.findUnique({
    where: { id: branchId },
    include: { client: { select: { id: true, name: true, managerId: true } } },
  })
  if (!targetBranch) return NextResponse.json({ error: 'Филиал не найден' }, { status: 404 })

  if (equipment.object.branchId === branchId) {
    return NextResponse.json({ error: 'Оборудование уже на этом филиале' }, { status: 400 })
  }

  const canTarget = await canReadClientScope(session as AuthedSession, targetBranch.clientId)
  if (!canTarget) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (role === 'MANAGER' && targetBranch.client.managerId !== session.user.id) {
    return NextResponse.json({ error: 'Нельзя перенести на филиал другого менеджера' }, { status: 403 })
  }

  const targetObjectId = await resolveTargetObjectId(
    branchId,
    targetBranch.name,
    typeof body.objectId === 'string' ? body.objectId : undefined,
  )
  if (!targetObjectId) {
    return NextResponse.json({ error: 'Площадка не найдена на выбранном филиале' }, { status: 400 })
  }

  const oldLabel = `${equipment.object.branch.client.name} / ${equipment.object.branch.name}`
  const newLabel = `${targetBranch.client.name} / ${targetBranch.name}`
  const comment =
    typeof body.comment === 'string' && body.comment.trim() ? body.comment.trim() : null

  const updated = await db.$transaction(async (tx) => {
    const eq = await tx.equipment.update({
      where: { id: params.id },
      data: { objectId: targetObjectId },
      include: {
        object: { include: { branch: { include: { client: true } } } },
      },
    })

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'TRANSFER',
        entity: 'Equipment',
        entityId: params.id,
        oldValue: oldLabel,
        newValue: newLabel,
        comment,
      },
    })

    return eq
  })

  await logUserActivity(session.user.id, UserActivityAction.EQUIPMENT_EDIT, req, {
    page: `/equipment/${params.id}`,
    metadata: { equipmentId: params.id, transfer: true, branchId },
  })

  return NextResponse.json(updated)
}

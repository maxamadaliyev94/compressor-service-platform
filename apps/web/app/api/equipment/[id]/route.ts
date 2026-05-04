import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getEquipmentClientId } from '@/lib/api-access'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (session.user.role === 'MANAGER') {
    const cid = await getEquipmentClientId(params.id)
    if (!cid) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const c = await db.client.findUnique({ where: { id: cid }, select: { managerId: true } })
    if (c?.managerId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const equipment = await db.equipment.update({
    where: { id: params.id },
    data: {
      brand: body.brand,
      model: body.model,
      type: body.type,
      currentHours: parseInt(body.currentHours) || 0,
      nextServiceHours: body.nextServiceHours ? parseInt(body.nextServiceHours) : undefined,
      warrantyUntil: body.warrantyUntil ? new Date(body.warrantyUntil) : null,
      status: body.status,
      notes: body.notes || null,
    },
  })
  return NextResponse.json(equipment)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (session.user.role === 'MANAGER') {
    const cid = await getEquipmentClientId(params.id)
    if (!cid) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const c = await db.client.findUnique({ where: { id: cid }, select: { managerId: true } })
    if (c?.managerId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const eq = await db.equipment.findUnique({
    where: { id: params.id },
    include: { tasks: { where: { deletedAt: null }, select: { id: true } } },
  })
  if (!eq) return NextResponse.json({ error: 'Оборудование не найдено' }, { status: 404 })
  if (eq.tasks.length > 0) {
    return NextResponse.json(
      { error: 'Нельзя удалить оборудование с существующими задачами. Сначала удалите или перенесите задачи.' },
      { status: 400 }
    )
  }

  await db.equipment.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}

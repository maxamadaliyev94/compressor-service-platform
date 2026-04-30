import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const client = await db.client.update({
    where: { id: params.id },
    data: {
      name: body.name,
      inn: body.inn || null,
      contactPerson: body.contactPerson || null,
      phone: body.phone || null,
      email: body.email || null,
      status: body.status,
      comment: body.comment || null,
    },
  })
  return NextResponse.json(client)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { status } = await req.json()

  const client = await db.client.update({
    where: { id: params.id },
    data: { status }
  })

  if (status === 'PASSIVE') {
    const branches = await db.branch.findMany({
      where: { clientId: params.id },
      include: { objects: true }
    })
    const objectIds = branches.flatMap(b => b.objects.map(o => o.id))

    await db.equipment.updateMany({
      where: { objectId: { in: objectIds } },
      data: { status: 'STOPPED' }
    })

    const equipmentIds = await db.equipment.findMany({
      where: { objectId: { in: objectIds } },
      select: { id: true }
    })
    await db.serviceTask.updateMany({
      where: {
        equipmentId: { in: equipmentIds.map(e => e.id) },
        status: { in: ['NEW', 'ASSIGNED', 'IN_PROGRESS'] }
      },
      data: { status: 'CANCELLED', cancelReason: 'Клиент отключён администратором' }
    })
  } else if (status === 'VIP' || status === 'STANDART') {
    const branches = await db.branch.findMany({
      where: { clientId: params.id },
      include: { objects: true }
    })
    const objectIds = branches.flatMap(b => b.objects.map(o => o.id))

    await db.equipment.updateMany({
      where: {
        objectId: { in: objectIds },
        status: 'STOPPED'
      },
      data: { status: 'WORKING' }
    })
  }

  return NextResponse.json(client)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  try {
    await db.client.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Невозможно удалить — есть связанные данные' }, { status: 400 })
  }
}

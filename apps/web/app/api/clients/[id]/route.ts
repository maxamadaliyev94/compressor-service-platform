import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = session.user.role
  const existing = await db.client.findUnique({
    where: { id: params.id },
    select: { id: true },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (role === 'ENGINEER' || role === 'CHIEF_ENGINEER' || role === 'CLIENT') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const data: {
    name?: string
    inn?: string | null
    contactPerson?: string | null
    phone?: string | null
    email?: string | null
    status?: 'VIP' | 'STANDART' | 'PASSIVE'
    isActive?: boolean
    comment?: string | null
    country?: string
    city?: string | null
  } = {}
  if (body.name !== undefined) data.name = body.name
  if (body.inn !== undefined) data.inn = body.inn || null
  if (body.contactPerson !== undefined) data.contactPerson = body.contactPerson || null
  if (body.phone !== undefined) data.phone = body.phone || null
  if (body.email !== undefined) data.email = body.email || null
  if (body.status !== undefined) data.status = body.status
  if (typeof body.isActive === 'boolean') data.isActive = body.isActive
  if (body.comment !== undefined) data.comment = body.comment || null
  if (body.country !== undefined) data.country = body.country || 'Узбекистан'
  if (body.city !== undefined) data.city = body.city || null
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Нет полей для обновления' }, { status: 400 })
  }

  const client = await db.client.update({
    where: { id: params.id },
    data,
  })
  return NextResponse.json(client)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json() as { status?: string; isActive?: boolean }
  const data: { status?: 'VIP' | 'STANDART' | 'PASSIVE'; isActive?: boolean } = {}
  if (body.status !== undefined && ['VIP', 'STANDART', 'PASSIVE'].includes(body.status)) {
    data.status = body.status as 'VIP' | 'STANDART' | 'PASSIVE'
  }
  if (typeof body.isActive === 'boolean') {
    data.isActive = body.isActive
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Нет полей для обновления' }, { status: 400 })
  }

  const client = await db.client.update({
    where: { id: params.id },
    data,
  })

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

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await req.json()) as { managerId?: string }
  if (!body.managerId) {
    return NextResponse.json({ error: 'managerId required' }, { status: 400 })
  }

  const manager = await db.user.findFirst({
    where: { id: body.managerId, role: 'MANAGER', isActive: true },
    select: { id: true },
  })
  if (!manager) {
    return NextResponse.json({ error: 'Manager not found' }, { status: 404 })
  }

  const client = await db.client.update({
    where: { id: params.id },
    data: { managerId: body.managerId },
    include: {
      manager: { select: { id: true, name: true, email: true, phone: true } },
    },
  })

  return NextResponse.json(client)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const client = await db.client.update({
    where: { id: params.id },
    data: { managerId: null },
  })

  return NextResponse.json(client)
}

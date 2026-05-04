import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import type { Role } from '@prisma/client'

async function assertCanEditClientNotify(session: { user: { id: string; role: string } }, clientId: string) {
  const role = session.user.role as Role
  if (role === 'ADMIN') return true
  if (role === 'MANAGER') {
    const c = await db.client.findUnique({
      where: { id: clientId },
      select: { managerId: true },
    })
    return c?.managerId === session.user.id
  }
  return false
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = await assertCanEditClientNotify(session, params.id)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await req.json()) as { userId?: string | null }
  const userId = body.userId === null || body.userId === undefined || body.userId === '' ? null : body.userId

  if (userId) {
    const user = await db.user.findFirst({
      where: { id: userId, isActive: true, role: { not: 'CLIENT' } },
      select: { id: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден или недоступен' }, { status: 400 })
    }
  }

  const client = await db.client.update({
    where: { id: params.id },
    data: { attachedNotifyUserId: userId },
    include: {
      attachedNotifyUser: { select: { id: true, name: true, login: true, email: true } },
    },
  })

  return NextResponse.json(client)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = await assertCanEditClientNotify(session, params.id)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const client = await db.client.update({
    where: { id: params.id },
    data: { attachedNotifyUserId: null },
    include: {
      attachedNotifyUser: { select: { id: true, name: true, login: true, email: true } },
    },
  })

  return NextResponse.json(client)
}

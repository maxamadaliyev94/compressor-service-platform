import { NextResponse } from 'next/server'
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

/** Учётные записи представителей компании (роль CLIENT) для выбора в уведомлениях. */
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = await assertCanEditClientNotify(session, params.id)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const users = await db.user.findMany({
    where: {
      role: 'CLIENT',
      isActive: true,
      OR: [{ clientId: params.id }, { clientId: null }],
    },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, login: true, email: true, clientId: true },
  })

  return NextResponse.json(users)
}

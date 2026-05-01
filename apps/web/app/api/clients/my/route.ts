import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'MANAGER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const clients = await db.client.findMany({
    where: { managerId: session.user.id },
    include: {
      manager: { select: { id: true, name: true, email: true, phone: true } },
      branches: { include: { objects: { include: { equipment: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(clients)
}

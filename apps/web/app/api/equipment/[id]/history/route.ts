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

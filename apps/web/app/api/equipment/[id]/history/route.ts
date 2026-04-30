import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

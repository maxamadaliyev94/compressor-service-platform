import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'MANAGER', 'CHIEF_ENGINEER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const engineers = await db.user.findMany({
    where: {
      role: { in: ['ENGINEER', 'CHIEF_ENGINEER'] },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      role: true,
      engineerStatus: true,
      isOnline: true,
      checkedInAt: true,
      checkedOutAt: true,
      assignedTasks: {
        where: {
          deletedAt: null,
          status: { in: ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'DRAFT', 'REVIEW'] },
        },
        orderBy: { updatedAt: 'desc' },
        take: 1,
        select: {
          id: true,
          type: true,
          status: true,
          equipment: { select: { brand: true, model: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(engineers)
}

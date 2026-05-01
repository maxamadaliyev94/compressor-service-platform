import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      role: true,
      isOnline: true,
      checkedInAt: true,
      checkedOutAt: true,
      engineerStatus: true,
    },
  })
  return NextResponse.json(user)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ENGINEER', 'CHIEF_ENGINEER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await req.json()) as { action?: 'checkin' | 'checkout' }
  if (!body.action) return NextResponse.json({ error: 'action required' }, { status: 400 })

  if (body.action === 'checkin') {
    const activeTasks = await db.serviceTask.count({
      where: {
        assignedToId: session.user.id,
        deletedAt: null,
        status: { in: ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'DRAFT', 'REVIEW'] },
      },
    })
    const user = await db.user.update({
      where: { id: session.user.id },
      data: {
        isOnline: true,
        checkedInAt: new Date(),
        engineerStatus: activeTasks > 0 ? 'BUSY' : 'FREE',
      },
      select: {
        id: true,
        isOnline: true,
        checkedInAt: true,
        checkedOutAt: true,
        engineerStatus: true,
      },
    })
    return NextResponse.json(user)
  }

  const user = await db.user.update({
    where: { id: session.user.id },
    data: {
      isOnline: false,
      checkedOutAt: new Date(),
      engineerStatus: 'OFFLINE',
    },
    select: {
      id: true,
      isOnline: true,
      checkedInAt: true,
      checkedOutAt: true,
      engineerStatus: true,
    },
  })
  return NextResponse.json(user)
}

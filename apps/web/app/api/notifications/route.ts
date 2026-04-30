import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const notifications = await db.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  return NextResponse.json(notifications)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json()) as { id?: string; readAll?: boolean }

  if (body.readAll) {
    await db.notification.updateMany({
      where: { userId: session.user.id, isRead: false },
      data: { isRead: true },
    })
  } else if (body.id) {
    await db.notification.updateMany({
      where: { id: body.id, userId: session.user.id },
      data: { isRead: true },
    })
  }
  return NextResponse.json({ ok: true })
}

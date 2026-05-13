import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import type { Role } from '@prisma/client'
import { getOrCreateDmRoom, isStaffRole, STAFF_ROLES } from '@/lib/internal-chat'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isStaffRole(session.user.role as Role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await req.json()) as { peerUserId?: unknown }
  const peerUserId = typeof body.peerUserId === 'string' ? body.peerUserId.trim() : ''
  if (!peerUserId || peerUserId === session.user.id) {
    return NextResponse.json({ error: 'Некорректный получатель' }, { status: 400 })
  }

  const peer = await db.user.findFirst({
    where: { id: peerUserId, isActive: true, role: { in: [...STAFF_ROLES] } },
    select: { id: true, name: true, role: true },
  })
  if (!peer) return NextResponse.json({ error: 'Пользователь недоступен' }, { status: 400 })

  const room = await getOrCreateDmRoom(session.user.id, peer.id)
  return NextResponse.json({ roomId: room.id, peer })
}

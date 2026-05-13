import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import type { Role } from '@prisma/client'
import { assertStaffCanAccessRoom } from '@/lib/internal-chat'

export async function POST(_req: Request, { params }: { params: { roomId: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = session.user.role as Role

  const room = await assertStaffCanAccessRoom(session.user.id, role, params.roomId)
  if (!room) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (room.type === 'GENERAL') {
    return NextResponse.json({ error: 'Общий чат нельзя скрыть' }, { status: 400 })
  }

  await db.chatRoomHidden.upsert({
    where: { userId_roomId: { userId: session.user.id, roomId: params.roomId } },
    create: { userId: session.user.id, roomId: params.roomId },
    update: {},
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: { roomId: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const room = await assertStaffCanAccessRoom(session.user.id, session.user.role as Role, params.roomId)
  if (!room) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await db.chatRoomHidden.deleteMany({
    where: { userId: session.user.id, roomId: params.roomId },
  })

  return NextResponse.json({ ok: true })
}

import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import type { Role } from '@prisma/client'
import {
  assertStaffCanAccessRoom,
  assertStaffCanAccessTaskChat,
  markRoomRead,
} from '@/lib/internal-chat'

export async function POST(_req: Request, { params }: { params: { roomId: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = session.user.role as Role

  const room = await assertStaffCanAccessRoom(session.user.id, role, params.roomId)
  if (!room) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (room.type === 'GENERAL') {
    if (role !== 'ADMIN') {
      return NextResponse.json({ error: 'Очистить общий чат может только администратор' }, { status: 403 })
    }
  } else if (room.type === 'TASK' && room.taskId) {
    try {
      await assertStaffCanAccessTaskChat(session.user.id, role, room.taskId)
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }
  // DIRECT: anyone in the room (assertStaffCanAccessRoom already checked)

  await db.chatMessage.deleteMany({ where: { roomId: params.roomId } })
  await db.chatRoom.update({
    where: { id: params.roomId },
    data: { updatedAt: new Date() },
  })
  await markRoomRead(session.user.id, params.roomId)

  return NextResponse.json({ ok: true })
}

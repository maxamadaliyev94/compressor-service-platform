import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import type { Role } from '@prisma/client'
import { assertStaffCanAccessRoom, markRoomRead } from '@/lib/internal-chat'

export async function POST(_req: Request, { params }: { params: { roomId: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const room = await assertStaffCanAccessRoom(session.user.id, session.user.role as Role, params.roomId)
  if (!room) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await markRoomRead(session.user.id, params.roomId)
  return NextResponse.json({ ok: true })
}

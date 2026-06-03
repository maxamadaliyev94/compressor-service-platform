import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import type { Role } from '@prisma/client'
import {
  acknowledgeEngineerInternalComment,
  assertStaffCanAccessRoom,
} from '@/lib/internal-chat'

export async function POST(
  _req: Request,
  { params }: { params: { roomId: string; messageId: string } }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = session.user.role as Role
  const room = await assertStaffCanAccessRoom(session.user.id, role, params.roomId)
  if (!room) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const metadata = await acknowledgeEngineerInternalComment(
      params.messageId,
      session.user.id,
      role
    )
    return NextResponse.json({ ok: true, metadata })
  } catch (e) {
    const code = e instanceof Error ? e.message : 'error'
    if (code === 'forbidden') return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
    if (code === 'already_acknowledged') {
      return NextResponse.json({ error: 'Комментарий уже принят' }, { status: 409 })
    }
    if (code === 'invalid_message') {
      return NextResponse.json({ error: 'Некорректное сообщение' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}

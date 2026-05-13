import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import type { Role } from '@prisma/client'
import { assertStaffCanAccessRoom, postChatMessage } from '@/lib/internal-chat'

export async function GET(_req: NextRequest, { params }: { params: { roomId: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = session.user.role as Role

  const room = await assertStaffCanAccessRoom(session.user.id, role, params.roomId)
  if (!room) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const messages = await db.chatMessage.findMany({
    where: { roomId: params.roomId },
    orderBy: { createdAt: 'asc' },
    take: 200,
    include: {
      author: { select: { id: true, name: true, role: true } },
    },
  })

  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      isSystem: m.isSystem,
      deletedAt: m.deletedAt?.toISOString() ?? null,
      editedAt: m.editedAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
      author: { id: m.author.id, name: m.author.name, role: m.author.role },
    })),
    currentUserId: session.user.id,
  })
}

export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = session.user.role as Role

  const room = await assertStaffCanAccessRoom(session.user.id, role, params.roomId)
  if (!room) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await req.json()) as { body?: unknown }
  const text = typeof body.body === 'string' ? body.body : ''
  if (!text.trim()) {
    return NextResponse.json({ error: 'Введите сообщение' }, { status: 400 })
  }

  try {
    const msg = await postChatMessage(params.roomId, session.user.id, text, false)
    return NextResponse.json({
      message: {
        id: msg.id,
        body: msg.body,
        isSystem: msg.isSystem,
        deletedAt: msg.deletedAt?.toISOString() ?? null,
        editedAt: msg.editedAt?.toISOString() ?? null,
        createdAt: msg.createdAt.toISOString(),
        author: { id: msg.author.id, name: msg.author.name },
      },
    })
  } catch {
    return NextResponse.json({ error: 'Не удалось отправить' }, { status: 400 })
  }
}

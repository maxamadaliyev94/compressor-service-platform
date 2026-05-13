import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import type { Role } from '@prisma/client'
import {
  assertStaffCanAccessTaskChat,
  getDmPeer,
  isStaffRole,
  postChatMessage,
} from '@/lib/internal-chat'

async function assertCanAccessRoom(userId: string, role: Role, roomId: string) {
  const room = await db.chatRoom.findUnique({
    where: { id: roomId },
    select: { id: true, type: true, dmKey: true, taskId: true },
  })
  if (!room) return null
  if (!isStaffRole(role)) return null

  if (room.type === 'GENERAL') return room

  if (room.type === 'DIRECT' && room.dmKey) {
    const peer = getDmPeer(room.dmKey, userId)
    if (!peer) return null
    return room
  }

  if (room.type === 'TASK' && room.taskId) {
    try {
      await assertStaffCanAccessTaskChat(userId, role, room.taskId)
      return room
    } catch {
      return null
    }
  }

  return null
}

export async function GET(_req: NextRequest, { params }: { params: { roomId: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = session.user.role as Role

  const room = await assertCanAccessRoom(session.user.id, role, params.roomId)
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
      createdAt: m.createdAt.toISOString(),
      author: { id: m.author.id, name: m.author.name, role: m.author.role },
    })),
  })
}

export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = session.user.role as Role

  const room = await assertCanAccessRoom(session.user.id, role, params.roomId)
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
        createdAt: msg.createdAt.toISOString(),
        author: { id: msg.author.id, name: msg.author.name },
      },
    })
  } catch {
    return NextResponse.json({ error: 'Не удалось отправить' }, { status: 400 })
  }
}

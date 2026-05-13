import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import type { Role } from '@prisma/client'
import { assertStaffCanAccessRoom } from '@/lib/internal-chat'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { roomId: string; messageId: string } }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const room = await assertStaffCanAccessRoom(session.user.id, session.user.role as Role, params.roomId)
  if (!room) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const msg = await db.chatMessage.findFirst({
    where: { id: params.messageId, roomId: params.roomId },
    select: { id: true, authorId: true, isSystem: true, deletedAt: true },
  })
  if (!msg) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (msg.isSystem || msg.authorId !== session.user.id || msg.deletedAt) {
    return NextResponse.json({ error: 'Нельзя изменить это сообщение' }, { status: 403 })
  }

  const body = (await req.json()) as { body?: unknown }
  const text = typeof body.body === 'string' ? body.body.trim() : ''
  if (!text) {
    return NextResponse.json({ error: 'Пустой текст' }, { status: 400 })
  }

  const updated = await db.chatMessage.update({
    where: { id: msg.id },
    data: {
      body: text,
      editedAt: new Date(),
    },
    include: { author: { select: { id: true, name: true, role: true, avatarUrl: true } } },
  })

  await db.chatRoom.update({
    where: { id: params.roomId },
    data: { updatedAt: new Date() },
  })

  return NextResponse.json({
    message: {
      id: updated.id,
      body: updated.body,
      isSystem: updated.isSystem,
      deletedAt: updated.deletedAt?.toISOString() ?? null,
      editedAt: updated.editedAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      author: {
        id: updated.author.id,
        name: updated.author.name,
        role: updated.author.role,
        avatarUrl: updated.author.avatarUrl,
      },
    },
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { roomId: string; messageId: string } }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const room = await assertStaffCanAccessRoom(session.user.id, session.user.role as Role, params.roomId)
  if (!room) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const msg = await db.chatMessage.findFirst({
    where: { id: params.messageId, roomId: params.roomId },
    select: { id: true, authorId: true, isSystem: true, deletedAt: true },
  })
  if (!msg) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (msg.isSystem || msg.authorId !== session.user.id || msg.deletedAt) {
    return NextResponse.json({ error: 'Нельзя удалить это сообщение' }, { status: 403 })
  }

  await db.chatMessage.update({
    where: { id: msg.id },
    data: {
      deletedAt: new Date(),
      body: '',
    },
  })

  await db.chatRoom.update({
    where: { id: params.roomId },
    data: { updatedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}

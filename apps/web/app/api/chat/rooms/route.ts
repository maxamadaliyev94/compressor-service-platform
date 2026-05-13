import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import type { Role } from '@prisma/client'
import {
  getDmPeer,
  getOrCreateGeneralRoom,
  getUnreadCountsForRooms,
  isStaffRole,
  STAFF_ROLES,
} from '@/lib/internal-chat'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = session.user.role as Role
  if (!isStaffRole(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const userId = session.user.id

  const hiddenRows = await db.chatRoomHidden.findMany({
    where: { userId },
    select: { roomId: true },
  })
  const hiddenIds = hiddenRows.map((h) => h.roomId)

  const general = await getOrCreateGeneralRoom()

  const dmRooms = await db.chatRoom.findMany({
    where: {
      type: 'DIRECT',
      ...(hiddenIds.length > 0 ? { id: { notIn: hiddenIds } } : {}),
      OR: [
        { dmKey: { startsWith: `${userId}:` } },
        { dmKey: { endsWith: `:${userId}` } },
      ],
    },
    include: {
      messages: {
        where: { deletedAt: null },
        take: 1,
        orderBy: { createdAt: 'desc' },
        include: { author: { select: { id: true, name: true } } },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  })

  const peerIds = new Set<string>()
  for (const r of dmRooms) {
    if (!r.dmKey) continue
    const peer = getDmPeer(r.dmKey, userId)
    if (peer) peerIds.add(peer)
  }
  const peers = await db.user.findMany({
    where: { id: { in: [...peerIds] }, role: { in: [...STAFF_ROLES] } },
    select: { id: true, name: true, role: true },
  })
  const peerMap = new Map(peers.map((p) => [p.id, p]))

  const taskWhere =
    role === 'ADMIN' || role === 'MANAGER' || role === 'CHIEF_ENGINEER'
      ? { deletedAt: null }
      : {
          deletedAt: null,
          OR: [{ assignedToId: userId }, { longTermEngineers: { some: { engineerId: userId } } }],
        }

  const taskRooms = await db.chatRoom.findMany({
    where: {
      type: 'TASK',
      ...(hiddenIds.length > 0 ? { id: { notIn: hiddenIds } } : {}),
      task: taskWhere,
    },
    include: {
      task: { select: { id: true, requestNumber: true } },
      messages: {
        where: { deletedAt: null },
        take: 1,
        orderBy: { createdAt: 'desc' },
        include: { author: { select: { id: true, name: true } } },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 80,
  })

  const generalLast = await db.chatMessage.findFirst({
    where: { roomId: general.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { id: true, name: true } } },
  })

  const roomIdsForUnread = [
    general.id,
    ...dmRooms.map((r) => r.id),
    ...taskRooms.map((r) => r.id),
  ]
  const unreadMap = await getUnreadCountsForRooms(userId, roomIdsForUnread)

  return NextResponse.json({
    currentUserId: userId,
    general: {
      id: general.id,
      type: 'GENERAL',
      title: 'Общий чат',
      unreadCount: unreadMap.get(general.id) ?? 0,
      lastMessage: generalLast
        ? {
            body: generalLast.body,
            createdAt: generalLast.createdAt.toISOString(),
            authorName: generalLast.author.name,
            isSystem: generalLast.isSystem,
          }
        : null,
    },
    direct: dmRooms.map((r) => {
      const peerId = r.dmKey ? getDmPeer(r.dmKey, userId) : null
      const peer = peerId ? peerMap.get(peerId) : null
      const last = r.messages[0]
      return {
        id: r.id,
        type: 'DIRECT',
        title: peer ? peer.name : 'Личный чат',
        unreadCount: unreadMap.get(r.id) ?? 0,
        peer: peer ? { id: peer.id, name: peer.name, role: peer.role } : null,
        lastMessage: last
          ? {
              body: last.body,
              createdAt: last.createdAt.toISOString(),
              authorName: last.author.name,
              isSystem: last.isSystem,
            }
          : null,
      }
    }),
    tasks: taskRooms.map((r) => {
      const last = r.messages[0]
      return {
        id: r.id,
        type: 'TASK',
        taskId: r.taskId,
        title: r.task ? `Задача №${r.task.requestNumber}` : 'Задача',
        unreadCount: unreadMap.get(r.id) ?? 0,
        lastMessage: last
          ? {
              body: last.body,
              createdAt: last.createdAt.toISOString(),
              authorName: last.author.name,
              isSystem: last.isSystem,
            }
          : null,
      }
    }),
    staffUsers: await db.user.findMany({
      where: { role: { in: [...STAFF_ROLES] }, isActive: true, id: { not: userId } },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    }),
    currentUserRole: session.user.role,
  })
}

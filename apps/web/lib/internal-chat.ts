import { db } from '@/lib/db'
import { createNotification } from '@/lib/notifications'
import type { ChatRoomType, Prisma, Role } from '@prisma/client'
import {
  isEngineerInternalCommentMetadata,
  type EngineerInternalCommentMetadata,
} from '@/lib/engineer-internal-comments'

export const STAFF_ROLES: Role[] = ['ADMIN', 'MANAGER', 'CHIEF_ENGINEER', 'ENGINEER']

export function isStaffRole(role: Role | string): boolean {
  return STAFF_ROLES.includes(role as Role)
}

export function makeDmKey(userIdA: string, userIdB: string): string {
  return [userIdA, userIdB].sort((a, b) => a.localeCompare(b)).join(':')
}

export function getDmPeer(dmKey: string, myUserId: string): string | null {
  const parts = dmKey.split(':')
  if (parts.length !== 2) return null
  if (parts[0] === myUserId) return parts[1]
  if (parts[1] === myUserId) return parts[0]
  return null
}

export async function getOrCreateGeneralRoom() {
  let room = await db.chatRoom.findFirst({ where: { type: 'GENERAL' } })
  if (!room) {
    room = await db.chatRoom.create({ data: { type: 'GENERAL' } })
  }
  return room
}

export async function getOrCreateCommentsRoom() {
  let room = await db.chatRoom.findFirst({ where: { type: 'COMMENTS' } })
  if (!room) {
    room = await db.chatRoom.create({ data: { type: 'COMMENTS' } })
  }
  return room
}

export async function getOrCreateDmRoom(userId: string, peerUserId: string) {
  if (userId === peerUserId) throw new Error('invalid_dm')
  const dmKey = makeDmKey(userId, peerUserId)
  let room = await db.chatRoom.findUnique({ where: { dmKey } })
  if (!room) {
    room = await db.chatRoom.create({ data: { type: 'DIRECT', dmKey } })
  }
  return room
}

export async function getOrCreateTaskRoom(taskId: string) {
  let room = await db.chatRoom.findUnique({ where: { taskId } })
  if (!room) {
    room = await db.chatRoom.create({ data: { type: 'TASK', taskId } })
  }
  return room
}

/** Доступ к чату задачи — как к просмотру карточки (инженер только если участник). */
export async function assertStaffCanAccessTaskChat(userId: string, role: Role, taskId: string): Promise<void> {
  if (!isStaffRole(role)) throw new Error('forbidden')
  const task = await db.serviceTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      deletedAt: true,
      assignedToId: true,
      longTermEngineers: { select: { engineerId: true } },
    },
  })
  if (!task || task.deletedAt) throw new Error('not_found')
  if (role === 'ADMIN' || role === 'MANAGER' || role === 'CHIEF_ENGINEER') return
  if (role === 'ENGINEER') {
    if (task.assignedToId === userId) return
    if (task.longTermEngineers.some((r) => r.engineerId === userId)) return
  }
  throw new Error('forbidden')
}

export type StaffAccessibleRoom = {
  id: string
  type: ChatRoomType
  dmKey: string | null
  taskId: string | null
}

export async function assertStaffCanAccessRoom(
  userId: string,
  role: Role,
  roomId: string
): Promise<StaffAccessibleRoom | null> {
  const room = await db.chatRoom.findUnique({
    where: { id: roomId },
    select: { id: true, type: true, dmKey: true, taskId: true },
  })
  if (!room || !isStaffRole(role)) return null
  if (room.type === 'GENERAL' || room.type === 'COMMENTS') return room
  if (room.type === 'DIRECT' && room.dmKey) {
    return getDmPeer(room.dmKey, userId) ? room : null
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

export async function markRoomRead(userId: string, roomId: string) {
  const now = new Date()
  await db.chatRoomReadState.upsert({
    where: { userId_roomId: { userId, roomId } },
    create: { userId, roomId, lastReadAt: now },
    update: { lastReadAt: now },
  })
}

async function collectAccessibleRoomIds(userId: string, role: Role): Promise<string[]> {
  const general = await getOrCreateGeneralRoom()
  const comments = await getOrCreateCommentsRoom()
  const hiddenRows = await db.chatRoomHidden.findMany({
    where: { userId },
    select: { roomId: true },
  })
  const hidden = new Set(hiddenRows.map((h) => h.roomId))

  const dmRooms = await db.chatRoom.findMany({
    where: {
      type: 'DIRECT',
      OR: [
        { dmKey: { startsWith: `${userId}:` } },
        { dmKey: { endsWith: `:${userId}` } },
      ],
    },
    select: { id: true },
  })

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
      task: taskWhere,
    },
    select: { id: true },
  })

  const ids: string[] = []
  if (!hidden.has(general.id)) ids.push(general.id)
  if (!hidden.has(comments.id)) ids.push(comments.id)
  for (const r of dmRooms) {
    if (!hidden.has(r.id)) ids.push(r.id)
  }
  for (const r of taskRooms) {
    if (!hidden.has(r.id)) ids.push(r.id)
  }
  return ids
}

export async function countUnreadMessagesTotal(userId: string, role: Role): Promise<number> {
  if (!isStaffRole(role)) return 0
  const roomIds = await collectAccessibleRoomIds(userId, role)
  if (roomIds.length === 0) return 0

  const states = await db.chatRoomReadState.findMany({
    where: { userId, roomId: { in: roomIds } },
    select: { roomId: true, lastReadAt: true },
  })
  const readMap = new Map(states.map((s) => [s.roomId, s.lastReadAt]))

  let total = 0
  for (const roomId of roomIds) {
    const lastRead = readMap.get(roomId) ?? new Date(0)
    const n = await db.chatMessage.count({
      where: {
        roomId,
        authorId: { not: userId },
        deletedAt: null,
        createdAt: { gt: lastRead },
      },
    })
    total += n
  }
  return total
}

/** Непрочитанные по каждой комнате (сообщения от других после lastReadAt). */
export async function getUnreadCountsForRooms(
  userId: string,
  roomIds: string[]
): Promise<Map<string, number>> {
  if (roomIds.length === 0) return new Map()

  const states = await db.chatRoomReadState.findMany({
    where: { userId, roomId: { in: roomIds } },
    select: { roomId: true, lastReadAt: true },
  })
  const readMap = new Map(states.map((s) => [s.roomId, s.lastReadAt]))

  const pairs = await Promise.all(
    roomIds.map(async (roomId) => {
      const lastRead = readMap.get(roomId) ?? new Date(0)
      const n = await db.chatMessage.count({
        where: {
          roomId,
          authorId: { not: userId },
          deletedAt: null,
          createdAt: { gt: lastRead },
        },
      })
      return [roomId, n] as const
    })
  )
  return new Map(pairs)
}

async function notifyChatRecipients(
  room: { id: string; type: ChatRoomType; dmKey: string | null },
  authorId: string,
  preview: string
) {
  const link = `/chat?room=${room.id}`
  const title = 'Новое сообщение в чате'
  const message = preview.length > 220 ? `${preview.slice(0, 217)}…` : preview

  if (room.type === 'DIRECT' && room.dmKey) {
    const peer = getDmPeer(room.dmKey, authorId)
    if (peer) {
      await createNotification({
        userId: peer,
        title,
        message,
        type: 'CHAT',
        link,
      })
    }
    return
  }

  if (room.type === 'GENERAL' || room.type === 'COMMENTS' || room.type === 'TASK') {
    const recipients = await db.user.findMany({
      where: {
        role: { in: [...STAFF_ROLES] },
        isActive: true,
        id: { not: authorId },
      },
      select: { id: true },
    })
    await Promise.all(
      recipients.map((u) =>
        createNotification({
          userId: u.id,
          title,
          message,
          type: 'CHAT',
          link,
        })
      )
    )
  }
}

export async function postChatMessage(roomId: string, authorId: string, body: string, isSystem = false) {
  const trimmed = body.trim()
  if (!trimmed) throw new Error('empty_body')

  const msg = await db.chatMessage.create({
    data: {
      roomId,
      authorId,
      body: trimmed,
      isSystem,
    },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      room: { select: { id: true, type: true, dmKey: true } },
    },
  })

  await db.chatRoom.update({
    where: { id: roomId },
    data: { updatedAt: new Date() },
  })

  await db.chatRoomHidden.deleteMany({ where: { roomId } })

  const preview = isSystem ? trimmed : `${msg.author.name}: ${trimmed}`
  await notifyChatRecipients(msg.room, authorId, preview)

  await markRoomRead(authorId, roomId)

  return msg
}

export async function postEngineerInternalCommentMessage(
  roomId: string,
  authorId: string,
  body: string,
  metadata: Prisma.InputJsonValue
) {
  const trimmed = body.trim()
  if (!trimmed) throw new Error('empty_body')

  const msg = await db.chatMessage.create({
    data: {
      roomId,
      authorId,
      body: trimmed,
      isSystem: false,
      metadata,
    },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      room: { select: { id: true, type: true, dmKey: true } },
    },
  })

  await db.chatRoom.update({
    where: { id: roomId },
    data: { updatedAt: new Date() },
  })

  await db.chatRoomHidden.deleteMany({ where: { roomId } })

  const preview = `Внутренний комментарий: ${trimmed}`
  await notifyChatRecipients(msg.room, authorId, preview)
  await markRoomRead(authorId, roomId)

  return msg
}

const ACK_ROLES: Role[] = ['ADMIN', 'MANAGER', 'CHIEF_ENGINEER']

export function canAckEngineerInternalComment(role: Role | string): boolean {
  return ACK_ROLES.includes(role as Role)
}

export async function acknowledgeEngineerInternalComment(
  messageId: string,
  userId: string,
  role: Role
): Promise<EngineerInternalCommentMetadata | null> {
  if (!canAckEngineerInternalComment(role)) throw new Error('forbidden')

  const msg = await db.chatMessage.findUnique({
    where: { id: messageId },
    include: { room: { select: { type: true } } },
  })
  if (!msg || msg.deletedAt || msg.room.type !== 'COMMENTS') throw new Error('not_found')
  if (!isEngineerInternalCommentMetadata(msg.metadata)) throw new Error('invalid_message')
  if (msg.metadata.acknowledged) throw new Error('already_acknowledged')

  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true } })
  if (!user) throw new Error('not_found')

  const updated: EngineerInternalCommentMetadata = {
    ...msg.metadata,
    acknowledged: {
      userId,
      userName: user.name,
      at: new Date().toISOString(),
    },
  }

  await db.chatMessage.update({
    where: { id: messageId },
    data: { metadata: updated as Prisma.InputJsonValue },
  })

  return updated
}

function assigneeDescription(task: {
  assignedTo: { name: string; role: Role } | null
  longTermEngineers: { engineer: { name: string; role: Role } }[]
}): string {
  if (task.assignedTo) {
    const r = task.assignedTo.role
    if (r === 'CHIEF_ENGINEER') return `главный инженер ${task.assignedTo.name}`
    if (r === 'ENGINEER') return `инженер ${task.assignedTo.name}`
    return `${task.assignedTo.name}`
  }
  const names = task.longTermEngineers.map((x) => x.engineer.name).filter(Boolean)
  if (names.length === 1) return `инженер ${names[0]}`
  if (names.length > 1) return `инженеры: ${names.join(', ')}`
  return 'не назначен'
}

export async function announceNewTaskInGeneralChat(taskId: string, actorUserId: string) {
  const task = await db.serviceTask.findUnique({
    where: { id: taskId },
    include: {
      assignedTo: { select: { name: true, role: true } },
      longTermEngineers: { include: { engineer: { select: { name: true, role: true } } } },
      equipment: {
        include: {
          object: { include: { branch: { include: { client: { select: { name: true } } } } } },
        },
      },
    },
  })
  if (!task) return
  const clientName = task.equipment.object.branch.client.name
  const eqLabel = `${task.equipment.brand} ${task.equipment.model}`.trim()
  const who = assigneeDescription(task)
  const text = `Создана новая задача №${task.requestNumber} для клиента ${clientName} оборудование ${eqLabel} назначен ${who}`
  const room = await getOrCreateGeneralRoom()
  await postChatMessage(room.id, actorUserId, text, true)
}

export async function announceTaskCompletedInGeneralChat(taskId: string, actorUserId: string) {
  const actor = await db.user.findUnique({
    where: { id: actorUserId },
    select: { name: true },
  })
  const task = await db.serviceTask.findUnique({
    where: { id: taskId },
    select: { requestNumber: true },
  })
  if (!task || !actor) return
  const text = `Задача №${task.requestNumber} выполнена инженером ${actor.name}`
  const room = await getOrCreateGeneralRoom()
  await postChatMessage(room.id, actorUserId, text, true)
}

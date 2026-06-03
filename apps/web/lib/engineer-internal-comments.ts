import { db } from '@/lib/db'
import { getOrCreateCommentsRoom, postEngineerInternalCommentMessage } from '@/lib/internal-chat'
import type { Prisma } from '@prisma/client'

export type EngineerInternalCommentMetadata = {
  kind: 'ENGINEER_INTERNAL'
  taskId: string
  taskNumber: number
  branchName: string
  equipmentBrand: string
  equipmentModel: string
  serialNumber: string
  commentText: string
  acknowledged?: {
    userId: string
    userName: string
    at: string
  }
}

export function isEngineerInternalCommentMetadata(
  value: unknown
): value is EngineerInternalCommentMetadata {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return v.kind === 'ENGINEER_INTERNAL' && typeof v.taskId === 'string' && typeof v.commentText === 'string'
}

export type BranchInternalCommentItem = {
  id: string
  commentText: string
  createdAt: string
  engineerName: string
  taskNumber: number
  equipmentBrand: string
  equipmentModel: string
  serialNumber: string
}

export async function fetchBranchInternalComments(
  branchId: string,
  limit = 5
): Promise<BranchInternalCommentItem[]> {
  const reports = await db.workReport.findMany({
    where: {
      notes: { not: null },
      task: {
        deletedAt: null,
        equipment: {
          object: { branchId },
        },
      },
    },
    orderBy: { finishedAt: 'desc' },
    take: limit * 3,
    select: {
      id: true,
      notes: true,
      finishedAt: true,
      engineer: { select: { name: true } },
      task: {
        select: {
          requestNumber: true,
          equipment: { select: { brand: true, model: true, serialNumber: true } },
        },
      },
    },
  })

  const items: BranchInternalCommentItem[] = []
  for (const r of reports) {
    const text = r.notes?.trim()
    if (!text) continue
    items.push({
      id: r.id,
      commentText: text,
      createdAt: r.finishedAt.toISOString(),
      engineerName: r.engineer.name,
      taskNumber: r.task.requestNumber,
      equipmentBrand: r.task.equipment.brand,
      equipmentModel: r.task.equipment.model,
      serialNumber: r.task.equipment.serialNumber,
    })
    if (items.length >= limit) break
  }
  return items
}

export async function postEngineerInternalComment(params: {
  taskId: string
  authorId: string
  commentText: string
}) {
  const text = params.commentText.trim()
  if (!text) return null

  const task = await db.serviceTask.findUnique({
    where: { id: params.taskId },
    select: {
      id: true,
      requestNumber: true,
      equipment: {
        select: {
          brand: true,
          model: true,
          serialNumber: true,
          object: { select: { branch: { select: { name: true } } } },
        },
      },
    },
  })
  if (!task) return null

  const author = await db.user.findUnique({
    where: { id: params.authorId },
    select: { name: true },
  })
  if (!author) return null

  const metadata: EngineerInternalCommentMetadata = {
    kind: 'ENGINEER_INTERNAL',
    taskId: task.id,
    taskNumber: task.requestNumber,
    branchName: task.equipment.object.branch.name,
    equipmentBrand: task.equipment.brand,
    equipmentModel: task.equipment.model,
    serialNumber: task.equipment.serialNumber,
    commentText: text,
  }

  const body = [
    `Филиал: ${metadata.branchName}`,
    `Оборудование: ${metadata.equipmentBrand} ${metadata.equipmentModel} (${metadata.serialNumber})`,
    `Задача №${metadata.taskNumber}`,
    `Инженер: ${author.name}`,
    '',
    text,
  ].join('\n')

  const room = await getOrCreateCommentsRoom()
  return postEngineerInternalCommentMessage(room.id, params.authorId, body, metadata as Prisma.InputJsonValue)
}

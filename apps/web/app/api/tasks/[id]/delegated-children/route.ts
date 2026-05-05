import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { parseDelegationParentTaskId } from '@/lib/task-delegation'
import type { Role } from '@prisma/client'

/** Список дочерних задач, созданных распределением с родителя `params.id`. */
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = session.user.role as Role
  const parentId = params.id

  const parent = await db.serviceTask.findUnique({
    where: { id: parentId },
    select: { id: true, assignedToId: true, deletedAt: true },
  })
  if (!parent || parent.deletedAt) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const parentWithClient = await db.serviceTask.findUnique({
    where: { id: parentId },
    select: { equipment: { select: { object: { select: { branch: { select: { client: { select: { managerId: true } } } } } } } } },
  })
  const managerOwnsClient = parentWithClient?.equipment.object.branch.client.managerId === session.user.id
  const allowed =
    role === 'ADMIN' ||
    (role === 'CHIEF_ENGINEER' && parent.assignedToId === session.user.id) ||
    (role === 'MANAGER' && managerOwnsClient)
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const marker = `[Распределено ГИ из задачи ${parentId}]`
  const children = await db.serviceTask.findMany({
    where: {
      deletedAt: null,
      comment: { contains: marker },
    },
    select: {
      id: true,
      status: true,
      assignedToId: true,
      comment: true,
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const filtered = children.filter((c) => parseDelegationParentTaskId(c.comment) === parentId)

  return NextResponse.json({
    children: filtered.map(({ id, status, assignedToId, assignedTo }) => ({
      id,
      status,
      assignedToId,
      assignedTo,
    })),
  })
}

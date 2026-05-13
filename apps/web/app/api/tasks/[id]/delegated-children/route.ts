import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { parseDelegationParentTaskId } from '@/lib/task-delegation'
import { participationStatusToUiTaskStatus } from '@/lib/task-participation'
import type { Role } from '@prisma/client'

type ChildRow = {
  id: string
  status: string
  assignedToId: string | null
  assignedTo: { id: string; name: string } | null
  isLegacyChild?: boolean
}

/** Список исполнителей по родительской заявке: соисполнители (junction) и устаревшие дочерние задачи. */
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = session.user.role as Role
  const parentId = params.id

  const parent = await db.serviceTask.findUnique({
    where: { id: parentId },
    select: { id: true, assignedToId: true, managedByChiefId: true, deletedAt: true },
  })
  if (!parent || parent.deletedAt) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const allowed =
    role === 'ADMIN' ||
    (role === 'CHIEF_ENGINEER' &&
      (parent.assignedToId === session.user.id || parent.managedByChiefId === session.user.id)) ||
    role === 'MANAGER'
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const junctionRows = await db.longTermTaskEngineer.findMany({
    where: { taskId: parentId },
    include: { engineer: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const fromJunction: ChildRow[] = junctionRows.map((r) => ({
    id: r.id,
    status: participationStatusToUiTaskStatus(r.participationStatus),
    assignedToId: r.engineerId,
    assignedTo: r.engineer,
  }))

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
  const fromLegacy: ChildRow[] = filtered.map(({ id, status, assignedToId, assignedTo }) => ({
    id,
    status,
    assignedToId,
    assignedTo,
  }))

  const seenEngineers = new Set(fromJunction.map((c) => c.assignedToId).filter(Boolean) as string[])
  const legacyOnly = fromLegacy.filter((c) => c.assignedToId && !seenEngineers.has(c.assignedToId))

  return NextResponse.json({
    children: [
      ...fromJunction.map((c) => ({ ...c, isLegacyChild: false as const })),
      ...legacyOnly.map((c) => ({ ...c, isLegacyChild: true as const })),
    ],
  })
}

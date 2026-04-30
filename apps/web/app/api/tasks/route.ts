import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { notifyTaskAssigned } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const task = await db.serviceTask.create({
    data: {
      equipmentId: body.equipmentId,
      createdById: session.user.id,
      assignedToId: body.assignedToId || null,
      type: body.type,
      priority: body.priority || 'MEDIUM',
      status: body.assignedToId ? 'ASSIGNED' : 'NEW',
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      comment: body.comment || null,
    },
  })

  if (task.assignedToId) {
    const [assignedUser, createdByUser] = await Promise.all([
      db.user.findUnique({ where: { id: task.assignedToId } }),
      db.user.findUnique({ where: { id: task.createdById } }),
    ])
    if (assignedUser && createdByUser) {
      await notifyTaskAssigned(task, assignedUser, createdByUser)
    }
  }

  return NextResponse.json(task)
}

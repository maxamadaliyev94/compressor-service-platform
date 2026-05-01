import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { markEngineerBusy, syncEngineerFreeIfNoActiveTasks } from '@/lib/engineerPresence'

export async function PATCH(_: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Только администратор может восстанавливать задачи' }, { status: 403 })
  }

  const task = await db.serviceTask.findUnique({
    where: { id: params.id },
    select: { id: true, assignedToId: true, deletedAt: true, deletedStatus: true },
  })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!task.deletedAt) {
    return NextResponse.json({ error: 'Задача не находится в корзине' }, { status: 400 })
  }

  await db.serviceTask.update({
    where: { id: params.id },
    data: {
      deletedAt: null,
      deletedById: null,
      status: task.deletedStatus ?? 'NEW',
      deletedStatus: null,
    },
  })

  if (task.assignedToId) {
    const restoredStatus = task.deletedStatus ?? 'NEW'
    if (['NEW', 'ASSIGNED', 'IN_PROGRESS', 'DRAFT', 'REVIEW'].includes(restoredStatus)) {
      await markEngineerBusy(task.assignedToId)
    } else {
      await syncEngineerFreeIfNoActiveTasks(task.assignedToId)
    }
  }

  return NextResponse.json({ ok: true })
}

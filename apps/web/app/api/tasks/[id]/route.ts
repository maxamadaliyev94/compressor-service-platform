import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { syncEngineerFreeIfNoActiveTasks } from '@/lib/engineerPresence'

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Только администратор может удалять задачи' }, { status: 403 })
  }

  const task = await db.serviceTask.findUnique({
    where: { id: params.id },
    select: { id: true, status: true, assignedToId: true, deletedAt: true, report: { select: { id: true } } },
  })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (task.deletedAt) {
    return NextResponse.json({ error: 'Задача уже находится в корзине' }, { status: 400 })
  }
  if (task.report) {
    return NextResponse.json(
      { error: 'Нельзя удалить задачу с уже созданным отчётом' },
      { status: 400 }
    )
  }

  await db.serviceTask.update({
    where: { id: params.id },
    data: {
      deletedAt: new Date(),
      deletedById: session.user.id,
      deletedStatus: task.status,
      status: 'CANCELLED',
    },
  })
  if (task.assignedToId) {
    await syncEngineerFreeIfNoActiveTasks(task.assignedToId)
  }
  return NextResponse.json({ ok: true })
}

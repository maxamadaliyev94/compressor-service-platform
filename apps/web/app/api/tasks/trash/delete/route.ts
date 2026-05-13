import { auth } from '@/auth'
import { db } from '@/lib/db'
import { logUserActivity, UserActivityAction } from '@/lib/user-activity-log'
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

/** Окончательное удаление задач, уже находящихся в корзине (soft-delete). Только ADMIN. */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Только администратор может удалять из корзины' }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null
  const rawIds = body?.ids
  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    return NextResponse.json({ error: 'Передайте массив ids' }, { status: 400 })
  }

  const ids = [...new Set(rawIds.filter((id): id is string => typeof id === 'string' && id.length > 0))]
  if (ids.length === 0) {
    return NextResponse.json({ error: 'Нет корректных идентификаторов' }, { status: 400 })
  }

  const tasks = await db.serviceTask.findMany({
    where: { id: { in: ids } },
    select: { id: true, deletedAt: true, equipmentId: true },
  })

  if (tasks.length !== ids.length) {
    return NextResponse.json({ error: 'Одна или несколько задач не найдены' }, { status: 400 })
  }
  if (tasks.some((t) => !t.deletedAt)) {
    return NextResponse.json(
      { error: 'Можно окончательно удалить только задачи из корзины' },
      { status: 400 },
    )
  }

  const taskIds = tasks.map((t) => t.id)

  await db.$transaction(async (tx) => {
    const reports = await tx.workReport.findMany({
      where: { taskId: { in: taskIds } },
      select: { id: true },
    })
    const reportIds = reports.map((r) => r.id)
    if (reportIds.length > 0) {
      await tx.checklistItem.deleteMany({ where: { reportId: { in: reportIds } } })
      await tx.partUsed.deleteMany({ where: { reportId: { in: reportIds } } })
      await tx.attachment.deleteMany({ where: { reportId: { in: reportIds } } })
      await tx.workReport.deleteMany({ where: { id: { in: reportIds } } })
    }
    await tx.serviceTask.deleteMany({
      where: { id: { in: taskIds }, deletedAt: { not: null } },
    })
  })

  revalidatePath('/tasks')
  revalidatePath('/tasks/kanban')
  revalidatePath('/equipment')
  for (const t of tasks) {
    revalidatePath(`/equipment/${t.equipmentId}`)
  }

  await logUserActivity(session.user.id, UserActivityAction.TASK_TRASH_PURGE, req, {
    page: '/tasks/trash',
    metadata: { ids: taskIds, count: taskIds.length },
  })

  return NextResponse.json({ ok: true, deleted: taskIds.length })
}

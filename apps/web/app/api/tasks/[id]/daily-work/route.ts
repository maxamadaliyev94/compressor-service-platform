import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { canReadTask, type AuthedSession } from '@/lib/api-access'
import {
  buildDailyWorkDescription,
  dailyChecklistToJson,
  parseDailyWorkChecklist,
} from '@/lib/daily-work-checklist'

function parseDay(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const d = new Date(`${value}T12:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = await canReadTask(session as AuthedSession, params.id)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const task = await db.serviceTask.findUnique({
    where: { id: params.id },
    select: { id: true, taskType: true, deletedAt: true },
  })
  if (!task || task.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (task.taskType !== 'LONG_TERM') {
    return NextResponse.json({ error: 'Не долгосрочная задача' }, { status: 400 })
  }

  const entries = await db.dailyWork.findMany({
    where: { taskId: params.id },
    include: { engineer: { select: { id: true, name: true } } },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      date: e.date.toISOString().slice(0, 10),
      description: e.description,
      checklist: e.checklist,
      engineer: e.engineer,
      createdAt: e.createdAt.toISOString(),
    })),
  })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ENGINEER') {
    return NextResponse.json({ error: 'Только инженер может вести дневной журнал' }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as {
    date?: string
    description?: string
    optionalNotes?: string
    checklist?: unknown
  } | null
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 })
  }

  const day = parseDay(body.date) ?? parseDay(new Date().toISOString().slice(0, 10))
  if (!day) return NextResponse.json({ error: 'Некорректная дата' }, { status: 400 })

  const checklist = parseDailyWorkChecklist(body.checklist)
  const checkedCount = checklist.filter((r) => r.checked).length
  if (checkedCount === 0) {
    return NextResponse.json({ error: 'Отметьте хотя бы одну выполненную работу из списка' }, { status: 400 })
  }

  const optionalNotes =
    typeof body.optionalNotes === 'string'
      ? body.optionalNotes.trim()
      : typeof body.description === 'string'
        ? body.description.trim()
        : ''
  const description = buildDailyWorkDescription(checklist, optionalNotes)
  const checklistJson = dailyChecklistToJson(checklist)

  const task = await db.serviceTask.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      taskType: true,
      status: true,
      deletedAt: true,
      assignedToId: true,
      report: { select: { id: true } },
      longTermEngineers: {
        where: { engineerId: session.user.id },
        select: { id: true },
      },
    },
  })
  if (!task || task.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (task.taskType !== 'LONG_TERM') {
    return NextResponse.json({ error: 'Не долгосрочная задача' }, { status: 400 })
  }
  if (['DONE', 'CANCELLED'].includes(task.status)) {
    return NextResponse.json({ error: 'Задача закрыта' }, { status: 400 })
  }
  const isLongTermMember =
    task.assignedToId === session.user.id || task.longTermEngineers.length > 0
  if (!isLongTermMember) {
    return NextResponse.json({ error: 'Вы не назначены на эту задачу' }, { status: 403 })
  }
  if (task.report) {
    return NextResponse.json({ error: 'Задача уже завершена' }, { status: 400 })
  }

  const row = await db.dailyWork.upsert({
    where: {
      taskId_engineerId_date: {
        taskId: params.id,
        engineerId: session.user.id,
        date: day,
      },
    },
    create: {
      taskId: params.id,
      engineerId: session.user.id,
      date: day,
      description,
      checklist: checklistJson,
    },
    update: { description, checklist: checklistJson },
  })

  return NextResponse.json({
    ok: true,
    entry: {
      id: row.id,
      date: row.date.toISOString().slice(0, 10),
      description: row.description,
      checklist: row.checklist,
    },
  })
}

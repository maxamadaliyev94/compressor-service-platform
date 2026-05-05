import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { atUtcMidnight, eachUtcDateInclusive } from '@/lib/task-schedule-display'

const BUSINESS_TIMEZONE = 'Asia/Tashkent'

type ScheduleTask = {
  id: string
  type: string
  priority: string
  status: string
  taskType: string
  scheduledAt: Date | null
  startDate: Date | null
  endDate: Date | null
  equipment: { brand: string; model: string; serialNumber: string }
}

function monthUtcRange(year: number, month1to12: number) {
  const start = new Date(Date.UTC(year, month1to12 - 1, 1))
  const end = new Date(Date.UTC(year, month1to12, 1))
  return { start, end }
}

function dateKeyInBusinessTimezone(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: BUSINESS_TIMEZONE })
}

/** День быстрой задачи: срок, иначе момент последнего изменения/создания. */
function quickCalendarDay(task: {
  scheduledAt: Date | null
  updatedAt: Date
  createdAt: Date
}): string {
  const anchor = task.scheduledAt ?? task.updatedAt ?? task.createdAt
  return dateKeyInBusinessTimezone(anchor)
}

function dateKeyInUtcMonth(dateKey: string, monthStart: Date, monthEndEx: Date): boolean {
  const t = new Date(`${dateKey}T12:00:00.000Z`).getTime()
  return t >= monthStart.getTime() && t < monthEndEx.getTime()
}

function longTermRangeBounds(task: {
  startDate: Date | null
  endDate: Date | null
  scheduledAt: Date | null
  createdAt: Date
}, monthStart: Date, monthEndEx: Date): { rangeStart: Date; rangeEnd: Date } | null {
  if (!task.startDate && !task.endDate) {
    const anchor = task.scheduledAt ?? task.createdAt
    const d = new Date(`${dateKeyInBusinessTimezone(anchor)}T12:00:00.000Z`)
    return { rangeStart: d, rangeEnd: d }
  }
  const s = task.startDate ? atUtcMidnight(task.startDate) : monthStart
  const e = task.endDate ? atUtcMidnight(task.endDate) : new Date(monthEndEx.getTime() - 86400000)
  return s.getTime() <= e.getTime() ? { rangeStart: s, rangeEnd: e } : { rangeStart: e, rangeEnd: s }
}

function daysOfLongTermInMonth(
  task: { startDate: Date | null; endDate: Date | null; scheduledAt: Date | null; createdAt: Date },
  monthStart: Date,
  monthEndEx: Date
): string[] {
  const rb = longTermRangeBounds(task, monthStart, monthEndEx)
  if (!rb) return []
  const monthLast = new Date(monthEndEx.getTime() - 86400000)
  const clipStart = rb.rangeStart.getTime() < monthStart.getTime() ? monthStart : rb.rangeStart
  const clipEnd = rb.rangeEnd.getTime() > monthLast.getTime() ? monthLast : rb.rangeEnd
  if (clipStart.getTime() > clipEnd.getTime()) return []
  return [...eachUtcDateInclusive(clipStart, clipEnd)]
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'MANAGER', 'CHIEF_ENGINEER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now = new Date()
  const month = Number(req.nextUrl.searchParams.get('month') ?? now.getMonth() + 1)
  const year = Number(req.nextUrl.searchParams.get('year') ?? now.getFullYear())
  const engineerId = req.nextUrl.searchParams.get('engineerId')

  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'Invalid month/year' }, { status: 400 })
  }

  const { start: monthStart, end: monthEndEx } = monthUtcRange(year, month)

  const engineers = await db.user.findMany({
    where: {
      role: { in: ['ENGINEER', 'CHIEF_ENGINEER'] },
      isActive: true,
      ...(engineerId ? { id: engineerId } : {}),
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  })
  const engineerIds = engineers.map((e) => e.id)

  if (engineerIds.length === 0) {
    return NextResponse.json({ month, year, engineers: [], schedule: [] })
  }

  const managerScope =
    session.user.role === 'MANAGER'
      ? { equipment: { object: { branch: { client: { managerId: session.user.id } } } } }
      : {}

  const taskSelect = {
    id: true,
    type: true,
    priority: true,
    status: true,
    taskType: true,
    scheduledAt: true,
    startDate: true,
    endDate: true,
    assignedToId: true,
    updatedAt: true,
    createdAt: true,
    equipment: { select: { brand: true, model: true, serialNumber: true } },
  } as const

  const quickTasksRaw = (await db.serviceTask.findMany({
    where: {
      taskType: 'QUICK',
      assignedToId: { in: engineerIds },
      deletedAt: null,
      status: { notIn: ['CANCELLED', 'DONE'] },
      ...managerScope,
    },
    select: taskSelect,
  })) as Array<ScheduleTask & { assignedToId: string | null; createdAt: Date }>

  const ltStaffLinks = await db.longTermTaskEngineer.findMany({
    where: { engineerId: { in: engineerIds } },
    select: { taskId: true },
  })
  const taskIdsFromLtStaff = [...new Set(ltStaffLinks.map((r) => r.taskId))]

  const ltTasksRaw = await db.serviceTask.findMany({
    where: {
      taskType: 'LONG_TERM',
      deletedAt: null,
      status: { notIn: ['CANCELLED', 'DONE'] },
      ...managerScope,
      OR: [
        { assignedToId: { in: engineerIds } },
        ...(taskIdsFromLtStaff.length > 0 ? [{ id: { in: taskIdsFromLtStaff } }] : []),
      ],
    },
    select: taskSelect,
  })

  const ltTaskIds = ltTasksRaw.map((t) => t.id)
  const allLtStaff =
    ltTaskIds.length > 0
      ? await db.longTermTaskEngineer.findMany({
          where: { taskId: { in: ltTaskIds } },
          select: { taskId: true, engineerId: true },
        })
      : []

  const engineerIdsByLtTask = new Map<string, Set<string>>()
  for (const row of allLtStaff) {
    let s = engineerIdsByLtTask.get(row.taskId)
    if (!s) {
      s = new Set()
      engineerIdsByLtTask.set(row.taskId, s)
    }
    s.add(row.engineerId)
  }

  /** cellKey `${engineerId}|${yyyy-mm-dd}` → taskId → task */
  const grid = new Map<string, Map<string, ScheduleTask>>()

  function add(engineerIdVal: string, dateKey: string, task: ScheduleTask) {
    if (!engineerIds.includes(engineerIdVal)) return
    const ck = `${engineerIdVal}|${dateKey}`
    let m = grid.get(ck)
    if (!m) {
      m = new Map()
      grid.set(ck, m)
    }
    m.set(task.id, task)
  }

  for (const task of quickTasksRaw) {
    if (!task.assignedToId) continue
    const dk = quickCalendarDay(task)
    if (!dateKeyInUtcMonth(dk, monthStart, monthEndEx)) continue
    const { createdAt: _c, ...payload } = task
    add(task.assignedToId, dk, payload as ScheduleTask)
  }

  for (const task of ltTasksRaw) {
    const days = daysOfLongTermInMonth(task, monthStart, monthEndEx)
    if (days.length === 0) continue

    const assigneeIds = new Set<string>()
    const fromLinks = engineerIdsByLtTask.get(task.id)
    if (fromLinks) for (const id of fromLinks) assigneeIds.add(id)
    if (task.assignedToId) assigneeIds.add(task.assignedToId)

    const { createdAt: _cr, ...taskPayload } = task
    for (const eng of assigneeIds) {
      for (const dateKey of days) {
        add(eng, dateKey, taskPayload as ScheduleTask)
      }
    }
  }

  const schedule = [...grid.entries()].map(([key, taskMap]) => {
    const [engineerIdValue, date] = key.split('|')
    const engineer = engineers.find((e) => e.id === engineerIdValue)
    const tasks = [...taskMap.values()]
    return {
      engineerId: engineerIdValue,
      engineerName: engineer?.name ?? '—',
      date,
      taskCount: tasks.length,
      tasks,
    }
  })

  return NextResponse.json({ month, year, engineers, schedule })
}

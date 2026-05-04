import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { atUtcMidnight, eachUtcDateInclusive } from '@/lib/task-schedule-display'

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

function longTermRangeBounds(task: { startDate: Date | null; endDate: Date | null }): {
  rangeStart: Date
  rangeEnd: Date
} | null {
  if (!task.startDate && !task.endDate) return null
  const s = task.startDate ? atUtcMidnight(task.startDate) : atUtcMidnight(task.endDate!)
  const e = task.endDate ? atUtcMidnight(task.endDate) : atUtcMidnight(task.startDate!)
  return s.getTime() <= e.getTime() ? { rangeStart: s, rangeEnd: e } : { rangeStart: e, rangeEnd: s }
}

function daysOfLongTermInMonth(
  task: { startDate: Date | null; endDate: Date | null },
  monthStart: Date,
  monthEndEx: Date
): string[] {
  const rb = longTermRangeBounds(task)
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
    equipment: { select: { brand: true, model: true, serialNumber: true } },
  } as const

  const quickTasks = (await db.serviceTask.findMany({
    where: {
      taskType: 'QUICK',
      assignedToId: { in: engineerIds },
      deletedAt: null,
      status: { notIn: ['CANCELLED', 'DONE'] },
      scheduledAt: { gte: monthStart, lt: monthEndEx },
      ...managerScope,
    },
    select: taskSelect,
  })) as Array<ScheduleTask & { assignedToId: string | null }>

  const ltTasks = (await db.serviceTask.findMany({
    where: {
      taskType: 'LONG_TERM',
      deletedAt: null,
      status: { notIn: ['CANCELLED', 'DONE'] },
      ...managerScope,
      OR: [
        { assignedToId: { in: engineerIds } },
        { longTermEngineers: { some: { engineerId: { in: engineerIds } } } },
      ],
    },
    select: {
      ...taskSelect,
      longTermEngineers: { select: { engineerId: true } },
    },
  })) as Array<
    ScheduleTask & { assignedToId: string | null; longTermEngineers: { engineerId: string }[] }
  >

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

  for (const task of quickTasks) {
    if (!task.assignedToId || !task.scheduledAt) continue
    const dk = atUtcMidnight(task.scheduledAt).toISOString().slice(0, 10)
    add(task.assignedToId, dk, task)
  }

  for (const task of ltTasks) {
    const days = daysOfLongTermInMonth(task, monthStart, monthEndEx)
    if (days.length === 0) continue

    const assigneeIds = new Set<string>()
    for (const row of task.longTermEngineers) {
      assigneeIds.add(row.engineerId)
    }
    if (task.assignedToId) {
      assigneeIds.add(task.assignedToId)
    }

    const { longTermEngineers: _lt, ...taskPayload } = task
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

  const engineerIdsInSchedule = new Set<string>()
  for (const k of grid.keys()) {
    engineerIdsInSchedule.add(k.split('|')[0])
  }

  const engineersResponse =
    session.user.role === 'MANAGER'
      ? engineers.filter((e) => engineerIdsInSchedule.has(e.id))
      : engineers

  return NextResponse.json({ month, year, engineers: engineersResponse, schedule })
}

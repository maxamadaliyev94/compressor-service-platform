import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

type ScheduleTask = {
  id: string
  type: string
  priority: string
  status: string
  scheduledAt: Date | null
  equipment: { brand: string; model: string; serialNumber: string }
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

  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))

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

  const tasks = (await db.serviceTask.findMany({
    where: {
      assignedToId: { in: engineerIds },
      deletedAt: null,
      status: { notIn: ['CANCELLED', 'DONE'] },
      scheduledAt: { gte: start, lt: end },
      ...managerScope,
    },
    select: {
      id: true,
      type: true,
      priority: true,
      status: true,
      scheduledAt: true,
      assignedToId: true,
      equipment: { select: { brand: true, model: true, serialNumber: true } },
    },
    orderBy: { scheduledAt: 'asc' },
  })) as Array<ScheduleTask & { assignedToId: string | null }>

  const grouped = new Map<string, ScheduleTask[]>()
  for (const task of tasks) {
    if (!task.assignedToId || !task.scheduledAt) continue
    const date = task.scheduledAt.toISOString().slice(0, 10)
    const key = `${task.assignedToId}|${date}`
    const arr = grouped.get(key) ?? []
    arr.push(task)
    grouped.set(key, arr)
  }

  const schedule = [...grouped.entries()].map(([key, dayTasks]) => {
    const [engineerIdValue, date] = key.split('|')
    const engineer = engineers.find((e) => e.id === engineerIdValue)
    return {
      engineerId: engineerIdValue,
      engineerName: engineer?.name ?? '—',
      date,
      taskCount: dayTasks.length,
      tasks: dayTasks,
    }
  })

  const engineerIdsInSchedule = new Set(tasks.map((t) => t.assignedToId).filter(Boolean) as string[])
  const engineersResponse =
    session.user.role === 'MANAGER'
      ? engineers.filter((e) => engineerIdsInSchedule.has(e.id))
      : engineers

  return NextResponse.json({ month, year, engineers: engineersResponse, schedule })
}

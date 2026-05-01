import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

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
  const taskType = req.nextUrl.searchParams.get('taskType')

  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'Invalid month/year' }, { status: 400 })
  }

  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))

  const engineers = await db.user.findMany({
    where: {
      role: { in: ['ENGINEER', 'CHIEF_ENGINEER'] },
      isActive: true,
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  })

  const tasks = await db.serviceTask.findMany({
    where: {
      deletedAt: null,
      status: 'DONE',
      completedAt: { gte: start, lt: end },
      assignedToId: engineerId && engineerId !== 'ALL' ? engineerId : undefined,
      type: taskType && taskType !== 'ALL' ? taskType : undefined,
      assignedTo: { role: { in: ['ENGINEER', 'CHIEF_ENGINEER'] } },
    },
    select: {
      id: true,
      requestNumber: true,
      type: true,
      status: true,
      createdAt: true,
      completedAt: true,
      assignedToId: true,
      assignedTo: { select: { id: true, name: true } },
      equipment: {
        select: {
          brand: true,
          model: true,
          serialNumber: true,
          object: { select: { branch: { select: { client: { select: { name: true } } } } } },
        },
      },
      report: { select: { id: true, actNumber: true } },
    },
    orderBy: { completedAt: 'desc' },
  })

  const groupedMap = new Map<string, { engineerId: string; engineerName: string; tasks: typeof tasks }>()
  for (const task of tasks) {
    if (!task.assignedToId || !task.assignedTo) continue
    if (!groupedMap.has(task.assignedToId)) {
      groupedMap.set(task.assignedToId, {
        engineerId: task.assignedToId,
        engineerName: task.assignedTo.name,
        tasks: [],
      })
    }
    groupedMap.get(task.assignedToId)!.tasks.push(task)
  }

  const grouped = [...groupedMap.values()].sort((a, b) => b.tasks.length - a.tasks.length)

  const totalDone = tasks.length
  const avgPerEngineer = grouped.length > 0 ? totalDone / grouped.length : 0
  const topEngineer = grouped[0] ? { id: grouped[0].engineerId, name: grouped[0].engineerName, taskCount: grouped[0].tasks.length } : null

  return NextResponse.json({
    month,
    year,
    engineers,
    grouped,
    stats: {
      totalDone,
      avgPerEngineer,
      topEngineer,
    },
  })
}

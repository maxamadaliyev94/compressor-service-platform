import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import type { TaskType } from '@prisma/client'

const TASK_TYPES = [
  'PLANNED_MAINTENANCE',
  'DIAGNOSTICS',
  'WARRANTY_REPAIR',
  'EMERGENCY',
  'INSTALLATION',
  'COMMISSIONING',
] as const satisfies readonly TaskType[]

function parseIsoDate(s: string | null): { y: number; m: number; d: number } | null {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!Number.isFinite(y) || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const t = Date.UTC(y, mo - 1, d)
  if (new Date(t).getUTCMonth() + 1 !== mo) return null
  return { y, m: mo, d }
}

function utcRangeInclusive(fromIso: string, toIso: string): { start: Date; end: Date } | null {
  const a = parseIsoDate(fromIso)
  const b = parseIsoDate(toIso)
  if (!a || !b) return null
  const start = new Date(Date.UTC(a.y, a.m - 1, a.d, 0, 0, 0, 0))
  const end = new Date(Date.UTC(b.y, b.m - 1, b.d, 23, 59, 59, 999))
  if (start.getTime() > end.getTime()) return null
  return { start, end }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'MANAGER', 'CHIEF_ENGINEER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const managerScope =
    session.user.role === 'MANAGER'
      ? { equipment: { object: { branch: { client: { managerId: session.user.id } } } } }
      : {}

  const pad = (n: number) => String(n).padStart(2, '0')
  const d = new Date()
  const dateFromDefault = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`
  const dateToDefault = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  const dateFrom = req.nextUrl.searchParams.get('dateFrom')?.trim() || dateFromDefault
  const dateTo = req.nextUrl.searchParams.get('dateTo')?.trim() || dateToDefault
  const range = utcRangeInclusive(dateFrom, dateTo)
  if (!range) {
    return NextResponse.json({ error: 'Некорректный диапазон дат (ожидается YYYY-MM-DD, «От» ≤ «До»)' }, { status: 400 })
  }

  const { start, end } = range
  const engineerId = req.nextUrl.searchParams.get('engineerId')
  const taskType = req.nextUrl.searchParams.get('taskType')
  const equipmentIdRaw = req.nextUrl.searchParams.get('equipmentId')
  const equipmentId =
    equipmentIdRaw && equipmentIdRaw !== 'ALL' && equipmentIdRaw.length >= 8 ? equipmentIdRaw : undefined

  const tasks = await db.serviceTask.findMany({
    where: {
      deletedAt: null,
      status: 'DONE',
      completedAt: { gte: start, lte: end },
      assignedToId: engineerId && engineerId !== 'ALL' ? engineerId : undefined,
      type:
        taskType && taskType !== 'ALL' && (TASK_TYPES as readonly string[]).includes(taskType)
          ? (taskType as TaskType)
          : undefined,
      equipmentId: equipmentId ?? undefined,
      assignedTo: { role: { in: ['ENGINEER', 'CHIEF_ENGINEER'] } },
      ...managerScope,
    },
    select: {
      id: true,
      requestNumber: true,
      type: true,
      status: true,
      createdAt: true,
      completedAt: true,
      assignedToId: true,
      equipmentId: true,
      assignedTo: { select: { id: true, name: true, role: true } },
      equipment: {
        select: {
          id: true,
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

  const engineerIdsInTasks = [...new Set(tasks.map((t) => t.assignedToId).filter(Boolean))] as string[]

  const engineers =
    session.user.role === 'MANAGER' && engineerIdsInTasks.length === 0
      ? []
      : await db.user.findMany({
          where: {
            role: { in: ['ENGINEER', 'CHIEF_ENGINEER'] },
            isActive: true,
            ...(session.user.role === 'MANAGER' ? { id: { in: engineerIdsInTasks } } : {}),
            ...(engineerId && engineerId !== 'ALL' ? { id: engineerId } : {}),
          },
          select: { id: true, name: true, role: true },
          orderBy: { name: 'asc' },
        })

  type TaskRow = (typeof tasks)[number]

  const groupedMap = new Map<string, { engineerId: string; engineerName: string; engineerRole: string; tasks: TaskRow[] }>()
  for (const task of tasks) {
    if (!task.assignedToId || !task.assignedTo) continue
    if (!groupedMap.has(task.assignedToId)) {
      groupedMap.set(task.assignedToId, {
        engineerId: task.assignedToId,
        engineerName: task.assignedTo.name,
        engineerRole: task.assignedTo.role,
        tasks: [],
      })
    }
    groupedMap.get(task.assignedToId)!.tasks.push(task)
  }

  const grouped = [...groupedMap.values()].sort((a, b) => b.tasks.length - a.tasks.length)

  const totalDone = tasks.length

  const engineerWorkloadGroups = grouped.filter((g) => g.engineerRole === 'ENGINEER')
  const engineerWorkloadTasks = tasks.filter((t) => t.assignedTo?.role === 'ENGINEER')
  const avgPerEngineer =
    engineerWorkloadGroups.length > 0 ? engineerWorkloadTasks.length / engineerWorkloadGroups.length : 0

  const topFromEngineers = [...engineerWorkloadGroups].sort((a, b) => b.tasks.length - a.tasks.length)
  const topEngineer = topFromEngineers[0]
    ? { id: topFromEngineers[0].engineerId, name: topFromEngineers[0].engineerName, taskCount: topFromEngineers[0].tasks.length }
    : null

  return NextResponse.json({
    dateFrom,
    dateTo,
    engineers,
    grouped,
    stats: {
      totalDone,
      avgPerEngineer,
      topEngineer,
    },
  })
}

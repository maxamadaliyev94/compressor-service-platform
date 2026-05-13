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

const ENGINEER_ROLES = ['ENGINEER', 'CHIEF_ENGINEER'] as const

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

const UNASSIGNED_ENGINEER_GROUP = {
  engineerId: '__unassigned__',
  engineerName: 'Не указан',
  engineerRole: 'NONE',
} as const

/** Момент завершения для фильтра по периоду и сортировки. */
function completionInstant(task: {
  completedAt: Date | null
  updatedAt: Date
  report: { finishedAt: Date | null; createdAt: Date } | null
}): Date | null {
  return task.completedAt ?? task.report?.finishedAt ?? task.report?.createdAt ?? task.updatedAt ?? null
}

type HistoryTaskRow = {
  assignedToId: string | null
  assignedTo: { id: string; name: string; role: string } | null
  report: {
    engineer: { id: string; name: string; role: string } | null
  } | null
  longTermEngineers: { engineerId: string; engineer: { id: string; name: string; role: string } }[]
}

function engineerGroupForHistory(task: HistoryTaskRow): {
  engineerId: string
  engineerName: string
  engineerRole: string
} {
  if (task.assignedToId && task.assignedTo) {
    return {
      engineerId: task.assignedToId,
      engineerName: task.assignedTo.name,
      engineerRole: task.assignedTo.role,
    }
  }
  if (task.report?.engineer) {
    return {
      engineerId: task.report.engineer.id,
      engineerName: task.report.engineer.name,
      engineerRole: task.report.engineer.role,
    }
  }
  const first = task.longTermEngineers?.find((r) =>
    ENGINEER_ROLES.includes(r.engineer.role as (typeof ENGINEER_ROLES)[number])
  )
  if (first) {
    return {
      engineerId: first.engineer.id,
      engineerName: first.engineer.name,
      engineerRole: first.engineer.role,
    }
  }
  return { ...UNASSIGNED_ENGINEER_GROUP }
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

  /** Период: дата закрытия на задаче, отчёт, либо обновление задачи (если нет отчёта и completedAt — типичная причина «пустой» истории). */
  const completionDateWhere = {
    OR: [
      { completedAt: { gte: start, lte: end } },
      {
        AND: [
          { completedAt: null },
          {
            OR: [
              { report: { finishedAt: { gte: start, lte: end } } },
              {
                AND: [{ report: { finishedAt: null } }, { report: { createdAt: { gte: start, lte: end } } }],
              },
              { AND: [{ report: null }, { updatedAt: { gte: start, lte: end } }] },
              { AND: [{ completedAt: null }, { updatedAt: { gte: start, lte: end } }] },
            ],
          },
        ],
      },
    ],
  }

  /** Учитываем основного исполнителя, соисполнителей и автора акта. */
  const engineerParticipationWhere =
    engineerId && engineerId !== 'ALL'
      ? {
          OR: [
            { assignedToId: engineerId },
            { longTermEngineers: { some: { engineerId } } },
            { report: { engineerId } },
          ],
        }
      : null

  const andFilters = [completionDateWhere, ...(engineerParticipationWhere ? [engineerParticipationWhere] : [])]

  const tasksRaw = await db.serviceTask.findMany({
    where: {
      deletedAt: null,
      status: 'DONE',
      ...managerScope,
      AND: andFilters,
      type:
        taskType && taskType !== 'ALL' && (TASK_TYPES as readonly string[]).includes(taskType)
          ? (taskType as TaskType)
          : undefined,
      equipmentId: equipmentId ?? undefined,
    },
    select: {
      id: true,
      requestNumber: true,
      type: true,
      status: true,
      createdAt: true,
      completedAt: true,
      updatedAt: true,
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
      report: {
        select: {
          id: true,
          actNumber: true,
          engineerId: true,
          finishedAt: true,
          createdAt: true,
          engineer: { select: { id: true, name: true, role: true } },
        },
      },
      longTermEngineers: {
        select: {
          engineerId: true,
          engineer: { select: { id: true, name: true, role: true } },
        },
      },
    },
  })

  const tasks = [...tasksRaw].sort((a, b) => {
    const ta = completionInstant(a)?.getTime() ?? 0
    const tb = completionInstant(b)?.getTime() ?? 0
    return tb - ta
  })

  const engineerIdsInTasks = new Set<string>()
  for (const t of tasks) {
    const g = engineerGroupForHistory(t as HistoryTaskRow)
    if (g.engineerId !== UNASSIGNED_ENGINEER_GROUP.engineerId) {
      engineerIdsInTasks.add(g.engineerId)
    }
  }
  const engineerIdsInTasksArr = [...engineerIdsInTasks]

  const engineers =
    session.user.role === 'MANAGER' && engineerIdsInTasksArr.length === 0
      ? []
      : await db.user.findMany({
          where: {
            role: { in: ['ENGINEER', 'CHIEF_ENGINEER'] },
            isActive: true,
            ...(session.user.role === 'MANAGER' ? { id: { in: engineerIdsInTasksArr } } : {}),
            ...(engineerId && engineerId !== 'ALL' ? { id: engineerId } : {}),
          },
          select: { id: true, name: true, role: true },
          orderBy: { name: 'asc' },
        })

  type TaskRow = (typeof tasks)[number]

  const groupedMap = new Map<
    string,
    { engineerId: string; engineerName: string; engineerRole: string; tasks: TaskRow[] }
  >()
  for (const task of tasks) {
    const group = engineerGroupForHistory(task as HistoryTaskRow)
    if (!groupedMap.has(group.engineerId)) {
      groupedMap.set(group.engineerId, {
        engineerId: group.engineerId,
        engineerName: group.engineerName,
        engineerRole: group.engineerRole,
        tasks: [],
      })
    }
    const effectiveCompletedAt = completionInstant(task)
    groupedMap.get(group.engineerId)!.tasks.push({
      ...task,
      completedAt: effectiveCompletedAt,
    })
  }

  const grouped = [...groupedMap.values()].sort((a, b) => b.tasks.length - a.tasks.length)

  const totalDone = tasks.length

  const engineerWorkloadGroups = grouped.filter((g) => g.engineerRole === 'ENGINEER')
  const engineerWorkloadTasks = tasks.filter((t) => {
    const g = engineerGroupForHistory(t as HistoryTaskRow)
    return g.engineerRole === 'ENGINEER'
  })
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

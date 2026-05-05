import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'MANAGER', 'CHIEF_ENGINEER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const engineers = await db.user.findMany({
    where: {
      role: { in: ['ENGINEER', 'CHIEF_ENGINEER'] },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      role: true,
      engineerStatus: true,
      isOnline: true,
      checkedInAt: true,
      checkedOutAt: true,
    },
    orderBy: { name: 'asc' },
  })

  const engineerIds = engineers.map((e) => e.id)
  if (engineerIds.length === 0) {
    return NextResponse.json([])
  }

  const taskSelect = {
    id: true,
    type: true,
    status: true,
    updatedAt: true,
    assignedToId: true,
    equipment: { select: { brand: true, model: true } },
  } as const

  const directTasks = await db.serviceTask.findMany({
    where: {
      deletedAt: null,
      status: 'IN_PROGRESS',
      assignedToId: { in: engineerIds },
    },
    select: taskSelect,
  })

  const ltLinks = await db.longTermTaskEngineer.findMany({
    where: {
      engineerId: { in: engineerIds },
      task: { deletedAt: null, status: 'IN_PROGRESS' },
    },
    select: {
      engineerId: true,
      task: { select: taskSelect },
    },
  })

  /** У инженера может быть несколько задач в работе — показываем самую недавно обновлённую. */
  const latestByEngineer = new Map<
    string,
    {
      updatedAt: Date
      payload: { id: string; type: string; status: string; equipment: { brand: string; model: string } }
    }
  >()

  function consider(engId: string | null, t: (typeof directTasks)[0]) {
    if (!engId || !engineerIds.includes(engId)) return
    const payload = {
      id: t.id,
      type: t.type,
      status: t.status,
      equipment: t.equipment,
    }
    const prev = latestByEngineer.get(engId)
    if (!prev || t.updatedAt.getTime() > prev.updatedAt.getTime()) {
      latestByEngineer.set(engId, { updatedAt: t.updatedAt, payload })
    }
  }

  for (const t of directTasks) {
    consider(t.assignedToId, t)
  }
  for (const row of ltLinks) {
    consider(row.engineerId, row.task)
  }

  const body = engineers.map((eng) => {
    const busyByTasks = latestByEngineer.has(eng.id)
    const stored = eng.engineerStatus
    const displayStatus =
      stored === 'OFFLINE' ? 'OFFLINE' : busyByTasks ? 'BUSY' : 'FREE'
    const latest = latestByEngineer.get(eng.id)
    return {
      ...eng,
      engineerStatus: displayStatus,
      currentTask: latest ? latest.payload : null,
    }
  })

  return NextResponse.json(body)
}

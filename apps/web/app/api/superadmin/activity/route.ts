import { APP_TIMEZONE } from '@/lib/app-timezone'
import { verifySuperadminBasicAuth } from '@/lib/superadmin-basic-auth'
import { burstDeleteFlag, nightLoginFlag, type ActivityRowLite } from '@/lib/user-activity-annotations'
import { USER_ACTIVITY_LABELS } from '@/lib/user-activity-log'
import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function startOfLocalDay(d = new Date()): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function msOverlap(a0: Date, a1: Date, b0: Date, b1: Date): number {
  const s = Math.max(a0.getTime(), b0.getTime())
  const e = Math.min(a1.getTime(), b1.getTime())
  return Math.max(0, e - s)
}

function sumSessionMsForWindow(
  sessions: { userId: string; startedAt: Date; lastSeenAt: Date; endedAt: Date | null }[],
  userId: string,
  winStart: Date,
  winEnd: Date,
): number {
  let sum = 0
  for (const s of sessions) {
    if (s.userId !== userId) continue
    const end = s.endedAt ?? s.lastSeenAt
    sum += msOverlap(s.startedAt, end, winStart, winEnd)
  }
  return sum
}

export async function GET(req: NextRequest) {
  if (!verifySuperadminBasicAuth(req)) {
    return new NextResponse(null, {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Superadmin"' },
    })
  }

  const sp = req.nextUrl.searchParams
  if (sp.get('logs') === '1') {
    const take = Math.min(200, Math.max(1, parseInt(sp.get('take') || '80', 10) || 80))
    const userId = sp.get('userId') || undefined
    const action = sp.get('action') || undefined
    const from = sp.get('from') ? new Date(sp.get('from')!) : undefined
    const to = sp.get('to') ? new Date(sp.get('to')!) : undefined
    if (from && Number.isNaN(from.getTime())) {
      return NextResponse.json({ error: 'bad from' }, { status: 400 })
    }
    if (to && Number.isNaN(to.getTime())) {
      return NextResponse.json({ error: 'bad to' }, { status: 400 })
    }

    const where = {
      ...(userId ? { userId } : {}),
      ...(action ? { action } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    }

    const rows = await db.userActivity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        user: { select: { name: true, login: true, role: true } },
      },
    })

    const lite: ActivityRowLite[] = rows.map((r) => ({
      userId: r.userId,
      action: r.action,
      createdAt: r.createdAt,
    }))

    const wider = await db.userActivity.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
      },
      select: { userId: true, action: true, createdAt: true },
      take: 4000,
    })
    const wideLite: ActivityRowLite[] = wider

    const logs = rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: r.user.name,
      login: r.user.login,
      role: r.user.role,
      action: r.action,
      actionLabel: USER_ACTIVITY_LABELS[r.action] ?? r.action,
      page: r.page,
      ip: r.ip,
      createdAt: r.createdAt.toISOString(),
      suspiciousBurst: burstDeleteFlag(
        { userId: r.userId, action: r.action, createdAt: r.createdAt },
        wideLite,
      ),
      suspiciousNightLogin: nightLoginFlag({ userId: r.userId, action: r.action, createdAt: r.createdAt }),
    }))

    return NextResponse.json({ logs })
  }

  const now = new Date()
  const dayStart = startOfLocalDay(now)
  const weekStart = new Date(dayStart)
  weekStart.setDate(weekStart.getDate() - 7)
  const monthStart = new Date(dayStart)
  monthStart.setDate(monthStart.getDate() - 30)

  const monthAgo = new Date(Date.now() - 30 * 86400000)
  const chartSince = new Date(Date.now() - 14 * 86400000)

  const [users, sessions, chartActs, groupCounts, lastDistinct, sessionsMonth] = await Promise.all([
    db.user.findMany({
      select: { id: true, name: true, login: true, role: true, loginSuspendedByAdmin: true },
      orderBy: { name: 'asc' },
    }),
    db.userSession.findMany({
      where: {
        OR: [{ endedAt: null }, { lastSeenAt: { gte: dayStart } }],
      },
      orderBy: { lastSeenAt: 'desc' },
      take: 100,
      include: {
        user: { select: { name: true, login: true, role: true, loginSuspendedByAdmin: true } },
      },
    }),
    db.userActivity.findMany({
      where: { createdAt: { gte: chartSince } },
      select: { createdAt: true },
      take: 20000,
    }),
    db.userActivity.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: monthAgo } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 30,
    }),
    db.$queryRaw<
      { userId: string; action: string; page: string | null; createdAt: Date; name: string; login: string; role: string }[]
    >`
      SELECT DISTINCT ON (ua."userId")
        ua."userId",
        ua.action,
        ua.page,
        ua."createdAt",
        u.name,
        u.login,
        u.role::text as role
      FROM user_activities ua
      INNER JOIN users u ON u.id = ua."userId"
      WHERE ua."createdAt" > NOW() - INTERVAL '180 days'
      ORDER BY ua."userId", ua."createdAt" DESC
    `,
    db.userSession.findMany({
      where: { startedAt: { gte: monthStart } },
      select: { userId: true, startedAt: true, lastSeenAt: true, endedAt: true },
    }),
  ])

  const chartHours = new Array(24).fill(0) as number[]
  for (const a of chartActs) {
    const h = parseInt(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: APP_TIMEZONE,
        hour: 'numeric',
        hour12: false,
      }).format(a.createdAt),
      10,
    )
    chartHours[h] = (chartHours[h] || 0) + 1
  }

  const topEntry = groupCounts[0]
  const uTop = users.find((x) => x.id === topEntry?.userId)
  let mostActive: { userId: string; name: string; login: string; role: string; count: number } | null = null
  if (topEntry && uTop) {
    mostActive = {
      userId: topEntry.userId,
      name: uTop.name,
      login: uTop.login,
      role: uTop.role,
      count: topEntry._count.id,
    }
  }

  const timeStats: Record<
    string,
    { todayMs: number; weekMs: number; monthMs: number; todayLabel: string; weekLabel: string; monthLabel: string }
  > = {}
  for (const u of users) {
    timeStats[u.id] = {
      todayMs: sumSessionMsForWindow(sessionsMonth, u.id, dayStart, now),
      weekMs: sumSessionMsForWindow(sessionsMonth, u.id, weekStart, now),
      monthMs: sumSessionMsForWindow(sessionsMonth, u.id, monthStart, now),
      todayLabel: '',
      weekLabel: '',
      monthLabel: '',
    }
    const fmt = (ms: number) => {
      const m = Math.round(ms / 60000)
      if (m < 60) return `${m} мин`
      const h = Math.floor(m / 60)
      const rm = m % 60
      return rm ? `${h} ч ${rm} мин` : `${h} ч`
    }
    timeStats[u.id].todayLabel = fmt(timeStats[u.id].todayMs)
    timeStats[u.id].weekLabel = fmt(timeStats[u.id].weekMs)
    timeStats[u.id].monthLabel = fmt(timeStats[u.id].monthMs)
  }

  const lastByUser = lastDistinct.map((r) => ({
    userId: r.userId,
    name: r.name,
    login: r.login,
    role: r.role,
    action: r.action,
    actionLabel: USER_ACTIVITY_LABELS[r.action] ?? r.action,
    page: r.page,
    at: r.createdAt.toISOString(),
  }))

  return NextResponse.json({
    users,
    sessions: sessions.map((s) => ({
      id: s.id,
      userId: s.userId,
      userName: s.user.name,
      login: s.user.login,
      role: s.user.role,
      suspended: s.user.loginSuspendedByAdmin,
      startedAt: s.startedAt.toISOString(),
      lastSeenAt: s.lastSeenAt.toISOString(),
      endedAt: s.endedAt?.toISOString() ?? null,
      ip: s.ip,
      deviceType: s.deviceType,
      browserName: s.browserName,
      city: s.city,
      country: s.country,
    })),
    chartHours,
    mostActive,
    timeStats,
    lastByUser,
    actionOptions: Object.entries(USER_ACTIVITY_LABELS).map(([value, label]) => ({ value, label })),
  })
}

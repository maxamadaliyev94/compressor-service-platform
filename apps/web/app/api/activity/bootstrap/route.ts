import { auth } from '@/auth'
import { getClientIp } from '@/lib/client-ip'
import { lookupIpGeo } from '@/lib/geo-ip'
import { parseUserAgentHints } from '@/lib/user-agent-hints'
import { UserActivityAction, logUserActivity } from '@/lib/user-activity-log'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const COOKIE = 'csp_sess'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 14

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id
  const jar = cookies()
  const sid = jar.get(COOKIE)?.value

  if (sid) {
    const existing = await db.userSession.findFirst({
      where: { id: sid, userId, endedAt: null },
    })
    if (existing) {
      await db.userSession.update({
        where: { id: existing.id },
        data: { lastSeenAt: new Date() },
      })
      return NextResponse.json({ ok: true, resumed: true })
    }
  }

  const ip = getClientIp(req)
  const userAgent = req.headers.get('user-agent') ?? null
  const { deviceType, browserName } = parseUserAgentHints(userAgent)
  const geo = await lookupIpGeo(ip)

  const row = await db.userSession.create({
    data: {
      userId,
      ip,
      userAgent,
      deviceType,
      browserName,
      city: geo.city,
      country: geo.country,
    },
  })

  await logUserActivity(userId, UserActivityAction.LOGIN, req, {
    page: '/login',
    metadata: { sessionId: row.id, deviceType, browserName, city: geo.city, country: geo.country },
  })

  const res = NextResponse.json({ ok: true, newSession: true, sessionId: row.id })
  res.cookies.set(COOKIE, row.id, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE,
  })
  return res
}

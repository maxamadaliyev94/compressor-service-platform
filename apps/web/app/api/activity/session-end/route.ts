import { auth } from '@/auth'
import { UserActivityAction, logUserActivity } from '@/lib/user-activity-log'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const COOKIE = 'csp_sess'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id
  const sid = cookies().get(COOKIE)?.value

  if (sid) {
    const row = await db.userSession.findFirst({
      where: { id: sid, userId, endedAt: null },
    })
    if (row) {
      await db.userSession.update({
        where: { id: row.id },
        data: { endedAt: new Date(), lastSeenAt: new Date() },
      })
    }
  }

  await logUserActivity(userId, UserActivityAction.LOGOUT, req, { page: '/' })

  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  return res
}

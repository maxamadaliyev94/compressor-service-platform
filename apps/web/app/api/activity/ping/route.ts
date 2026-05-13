import { auth } from '@/auth'
import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const COOKIE = 'csp_sess'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const sid = cookies().get(COOKIE)?.value
  if (!sid) return NextResponse.json({ ok: true, skipped: true })

  const row = await db.userSession.findFirst({
    where: { id: sid, userId: session.user.id, endedAt: null },
  })
  if (!row) return NextResponse.json({ ok: true, skipped: true })

  await db.userSession.update({
    where: { id: row.id },
    data: { lastSeenAt: new Date() },
  })
  return NextResponse.json({ ok: true })
}

import { verifySuperadminBasicAuth } from '@/lib/superadmin-basic-auth'
import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifySuperadminBasicAuth(_req)) {
    return new NextResponse(null, {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Superadmin"' },
    })
  }
  const id = params.id
  const user = await db.user.findUnique({ where: { id }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.user.update({
    where: { id },
    data: { sessionInvalidatedAt: new Date() },
  })
  await db.userSession.updateMany({
    where: { userId: id, endedAt: null },
    data: { endedAt: new Date(), lastSeenAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}

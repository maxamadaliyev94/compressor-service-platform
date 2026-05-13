import { verifySuperadminBasicAuth } from '@/lib/superadmin-basic-auth'
import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!verifySuperadminBasicAuth(req)) {
    return new NextResponse(null, {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Superadmin"' },
    })
  }
  const id = params.id
  const body = (await req.json().catch(() => null)) as { suspended?: boolean } | null
  if (!body || typeof body.suspended !== 'boolean') {
    return NextResponse.json({ error: 'Ожидается { "suspended": true|false }' }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { id }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.user.update({
    where: { id },
    data: {
      loginSuspendedByAdmin: body.suspended,
      ...(body.suspended ? { sessionInvalidatedAt: new Date() } : {}),
    },
  })

  if (body.suspended) {
    await db.userSession.updateMany({
      where: { userId: id, endedAt: null },
      data: { endedAt: new Date(), lastSeenAt: new Date() },
    })
  }

  const row = await db.user.findUnique({
    where: { id },
    select: { loginSuspendedByAdmin: true },
  })
  return NextResponse.json({ ok: true, loginSuspendedByAdmin: row?.loginSuspendedByAdmin ?? false })
}

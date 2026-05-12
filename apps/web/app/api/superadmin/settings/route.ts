import { parseDateInputUtc } from '@/lib/access-policy'
import { db } from '@/lib/db'
import { verifySuperadminBasicAuth } from '@/lib/superadmin-basic-auth'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest) {
  if (!verifySuperadminBasicAuth(req)) {
    return new NextResponse(null, {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Superadmin"' },
    })
  }

  const body = (await req.json()) as {
    subscriptionStart?: string | null
    subscriptionEnd?: string | null
  }

  const subscriptionStart = parseDateInputUtc(
    body.subscriptionStart === '' || body.subscriptionStart == null
      ? undefined
      : body.subscriptionStart,
  )
  const subscriptionEnd = parseDateInputUtc(
    body.subscriptionEnd === '' || body.subscriptionEnd == null
      ? undefined
      : body.subscriptionEnd,
  )

  await db.appSettings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      isActive: true,
      subscriptionStart,
      subscriptionEnd,
    },
    update: {
      subscriptionStart,
      subscriptionEnd,
    },
  })

  const row = await db.appSettings.findUnique({ where: { id: 'default' } })
  console.log('[api/superadmin/settings] saved', {
    subscriptionStart: row?.subscriptionStart,
    subscriptionEnd: row?.subscriptionEnd,
  })

  return NextResponse.json({
    subscriptionStart: row?.subscriptionStart ?? null,
    subscriptionEnd: row?.subscriptionEnd ?? null,
  })
}

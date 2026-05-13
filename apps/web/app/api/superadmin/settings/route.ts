import { parseDateInputUtc } from '@/lib/access-policy'
import { db } from '@/lib/db'
import { verifySuperadminBasicAuth } from '@/lib/superadmin-basic-auth'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function parseMaintenanceInstant(v: unknown): Date | null {
  if (v === null || v === '') return null
  if (typeof v !== 'string') return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return d
}

export async function PUT(req: NextRequest) {
  if (!verifySuperadminBasicAuth(req)) {
    return new NextResponse(null, {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Superadmin"' },
    })
  }

  const body = (await req.json()) as Record<string, unknown>
  const existing = await db.appSettings.findUnique({ where: { id: 'default' } })

  let subscriptionStart = existing?.subscriptionStart ?? null
  let subscriptionEnd = existing?.subscriptionEnd ?? null
  if ('subscriptionStart' in body) {
    subscriptionStart = parseDateInputUtc(
      body.subscriptionStart === '' || body.subscriptionStart == null
        ? undefined
        : String(body.subscriptionStart),
    )
  }
  if ('subscriptionEnd' in body) {
    subscriptionEnd = parseDateInputUtc(
      body.subscriptionEnd === '' || body.subscriptionEnd == null
        ? undefined
        : String(body.subscriptionEnd),
    )
  }

  let maintenanceStart = existing?.maintenanceStart ?? null
  let maintenanceEnd = existing?.maintenanceEnd ?? null
  let maintenanceMessage = existing?.maintenanceMessage ?? null

  if ('maintenanceStart' in body) {
    maintenanceStart = parseMaintenanceInstant(body.maintenanceStart)
  }
  if ('maintenanceEnd' in body) {
    maintenanceEnd = parseMaintenanceInstant(body.maintenanceEnd)
  }
  if ('maintenanceMessage' in body) {
    const s = body.maintenanceMessage
    maintenanceMessage = typeof s === 'string' ? (s.trim() || null) : null
  }

  const maintenanceTouched =
    'maintenanceStart' in body || 'maintenanceEnd' in body || 'maintenanceMessage' in body
  if (maintenanceTouched) {
    const hasAny =
      maintenanceStart != null || maintenanceEnd != null || maintenanceMessage != null
    if (hasAny) {
      if (!maintenanceStart || !maintenanceEnd) {
        return NextResponse.json(
          { error: 'Для плана технических работ нужны дата начала и дата окончания' },
          { status: 400 },
        )
      }
      if (maintenanceEnd.getTime() <= maintenanceStart.getTime()) {
        return NextResponse.json({ error: 'Окончание должно быть позже начала' }, { status: 400 })
      }
    } else {
      maintenanceStart = null
      maintenanceEnd = null
      maintenanceMessage = null
    }
  }

  await db.appSettings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      isActive: true,
      subscriptionStart,
      subscriptionEnd,
      maintenanceStart,
      maintenanceEnd,
      maintenanceMessage,
    },
    update: {
      subscriptionStart,
      subscriptionEnd,
      maintenanceStart,
      maintenanceEnd,
      maintenanceMessage,
    },
  })

  const row = await db.appSettings.findUnique({ where: { id: 'default' } })
  console.log('[api/superadmin/settings] saved', {
    subscriptionStart: row?.subscriptionStart,
    subscriptionEnd: row?.subscriptionEnd,
    maintenanceStart: row?.maintenanceStart,
    maintenanceEnd: row?.maintenanceEnd,
  })

  return NextResponse.json({
    subscriptionStart: row?.subscriptionStart ?? null,
    subscriptionEnd: row?.subscriptionEnd ?? null,
    maintenanceStart: row?.maintenanceStart?.toISOString() ?? null,
    maintenanceEnd: row?.maintenanceEnd?.toISOString() ?? null,
    maintenanceMessage: row?.maintenanceMessage ?? null,
  })
}

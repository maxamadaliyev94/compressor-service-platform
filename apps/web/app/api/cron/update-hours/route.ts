import { NextRequest, NextResponse } from 'next/server'
import { runAutoHoursUpdate } from '@/lib/auto-hours'

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const querySecret = req.nextUrl.searchParams.get('secret')
  const authHeader = req.headers.get('authorization')
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
  const headerSecret = req.headers.get('x-cron-secret')

  return querySecret === secret || bearer === secret || headerSecret === secret
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 })
  }

  const result = await runAutoHoursUpdate()
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    updated: result.updated,
    skipped: result.skipped,
  })
}


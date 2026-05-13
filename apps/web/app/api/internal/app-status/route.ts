import { computeGloballyAccessible } from '@/lib/access-policy'
import { db } from '@/lib/db'
import { computeMaintenanceState } from '@/lib/maintenance-policy'
import { unstable_noStore } from 'next/cache'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
/** Отключает кэширование fetch/Data Cache для этого route handler. */
export const fetchCache = 'force-no-store'

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  'Surrogate-Control': 'no-store',
} as const

async function readAppStatusPayload() {
  unstable_noStore()
  const row = await db.appSettings.findUnique({ where: { id: 'default' } })
  const accessible = computeGloballyAccessible(
    row ? { isActive: row.isActive, subscriptionEnd: row.subscriptionEnd } : null,
  )
  const now = new Date()
  const m = computeMaintenanceState(
    now,
    row
      ? {
          maintenanceStart: row.maintenanceStart,
          maintenanceEnd: row.maintenanceEnd,
          maintenanceMessage: row.maintenanceMessage,
        }
      : null,
  )
  return {
    accessible,
    maintenance: {
      phase: m.phase,
      message: m.message,
      start: m.start?.toISOString() ?? null,
      end: m.end?.toISOString() ?? null,
    },
  }
}

function jsonStatus(payload: Awaited<ReturnType<typeof readAppStatusPayload>>) {
  return NextResponse.json(payload, { headers: { ...noStoreHeaders } })
}

/** GET — для отладки; middleware использует POST. */
export async function GET() {
  const payload = await readAppStatusPayload()
  return jsonStatus(payload)
}

/** POST — вызывается из middleware (без кэширования как у типичного GET). */
export async function POST() {
  const payload = await readAppStatusPayload()
  return jsonStatus(payload)
}

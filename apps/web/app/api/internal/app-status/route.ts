import { computeGloballyAccessible } from '@/lib/access-policy'
import { db } from '@/lib/db'
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

async function readGloballyAccessible(): Promise<boolean> {
  unstable_noStore()
  const row = await db.appSettings.findUnique({ where: { id: 'default' } })
  return computeGloballyAccessible(
    row ? { isActive: row.isActive, subscriptionEnd: row.subscriptionEnd } : null,
  )
}

function jsonAccessible(accessible: boolean) {
  return NextResponse.json({ accessible }, { headers: { ...noStoreHeaders } })
}

/** GET — для отладки; middleware использует POST. */
export async function GET() {
  const accessible = await readGloballyAccessible()
  return jsonAccessible(accessible)
}

/** POST — вызывается из middleware (без кэширования как у типичного GET). */
export async function POST() {
  const accessible = await readGloballyAccessible()
  return jsonAccessible(accessible)
}

import { db } from '@/lib/db'
import { unstable_noStore } from 'next/cache'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
/** Отключает кэширование fetch/Data Cache для этого route handler. */
export const fetchCache = 'force-no-store'

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
} as const

async function readAppActive(): Promise<boolean> {
  unstable_noStore()
  const row = await db.appSettings.findUnique({ where: { id: 'default' } })
  return row?.isActive !== false
}

function jsonActive(active: boolean) {
  return NextResponse.json({ active }, { headers: { ...noStoreHeaders } })
}

/** GET — для отладки; middleware использует POST, чтобы обойти кэш GET. */
export async function GET() {
  const active = await readAppActive()
  return jsonActive(active)
}

/** POST — вызывается из middleware (не кэшируется как типичный GET). */
export async function POST() {
  const active = await readAppActive()
  return jsonActive(active)
}

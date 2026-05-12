import { db } from '@/lib/db'
import { unstable_noStore } from 'next/cache'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** Для middleware (Edge): каждый запрос — актуальное чтение из БД, без Full Route / Data Cache. */
export async function GET() {
  unstable_noStore()
  const row = await db.appSettings.findUnique({ where: { id: 'default' } })
  const active = row?.isActive !== false
  return NextResponse.json(
    { active },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
      },
    },
  )
}

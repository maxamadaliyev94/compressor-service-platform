import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** Для middleware (Edge): можно дергать без сессии; не относится к обычным пользователям. */
export async function GET() {
  const row = await db.appSettings.findUnique({ where: { id: 'default' } })
  return NextResponse.json({ active: row?.isActive !== false })
}

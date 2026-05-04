import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { canReadClientScope, type AuthedSession } from '@/lib/api-access'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return NextResponse.json([])

  const ok = await canReadClientScope(session as AuthedSession, clientId)
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const branches = await db.branch.findMany({ where: { clientId }, orderBy: { name: 'asc' } })
  return NextResponse.json(branches)
}

function parseCoord(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = session.user.role
  if (!['ADMIN', 'MANAGER', 'CHIEF_ENGINEER'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const clientId = typeof body.clientId === 'string' ? body.clientId : ''
  if (!clientId) return NextResponse.json({ error: 'clientId обязателен' }, { status: 400 })

  const ok = await canReadClientScope(session as AuthedSession, clientId)
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const branch = await db.branch.create({
    data: {
      clientId,
      name: body.name,
      address: body.address || null,
      latitude: parseCoord(body.latitude),
      longitude: parseCoord(body.longitude),
      contactPerson: body.contactPerson || null,
      phone: body.phone || null,
      workingHours: body.workingHours || null,
    },
  })
  return NextResponse.json(branch)
}

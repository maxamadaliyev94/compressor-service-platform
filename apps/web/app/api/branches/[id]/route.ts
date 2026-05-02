import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

function parseCoord(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = session.user.role
  if (role === 'ENGINEER' || role === 'CHIEF_ENGINEER' || role === 'CLIENT') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const existing = await db.branch.findUnique({
    where: { id: params.id },
    include: { client: { select: { managerId: true } } },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (role === 'MANAGER' && existing.client.managerId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const name =
    typeof body.name === 'string' ? body.name.trim() : existing.name
  if (!name) {
    return NextResponse.json({ error: 'Название обязательно' }, { status: 400 })
  }

  const strOrNull = (v: unknown) =>
    v === '' || v === null || v === undefined ? null : String(v).trim() || null

  const branch = await db.branch.update({
    where: { id: params.id },
    data: {
      name,
      address: strOrNull(body.address),
      contactPerson: strOrNull(body.contactPerson),
      phone: strOrNull(body.phone),
      workingHours: strOrNull(body.workingHours),
      latitude: body.latitude !== undefined ? parseCoord(body.latitude) : existing.latitude,
      longitude: body.longitude !== undefined ? parseCoord(body.longitude) : existing.longitude,
    },
  })
  return NextResponse.json(branch)
}

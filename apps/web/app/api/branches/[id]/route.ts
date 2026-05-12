import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { canReadClientScope, type AuthedSession } from '@/lib/api-access'

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
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await req.json()
  const name =
    typeof body.name === 'string' ? body.name.trim() : existing.name
  if (!name) {
    return NextResponse.json({ error: 'Название обязательно' }, { status: 400 })
  }

  let nextClientId = existing.clientId
  if (body.clientId !== undefined && body.clientId !== null) {
    const raw = typeof body.clientId === 'string' ? body.clientId.trim() : ''
    if (!raw) {
      return NextResponse.json({ error: 'Укажите организацию' }, { status: 400 })
    }
    if (raw !== existing.clientId) {
      const okTarget = await canReadClientScope(session as AuthedSession, raw)
      if (!okTarget) {
        return NextResponse.json({ error: 'Нет доступа к выбранной организации' }, { status: 403 })
      }
      const targetExists = await db.client.findUnique({ where: { id: raw }, select: { id: true } })
      if (!targetExists) {
        return NextResponse.json({ error: 'Организация не найдена' }, { status: 404 })
      }
      nextClientId = raw
    }
  }

  const strOrNull = (v: unknown) =>
    v === '' || v === null || v === undefined ? null : String(v).trim() || null

  const branch = await db.branch.update({
    where: { id: params.id },
    data: {
      clientId: nextClientId,
      name,
      address: body.address !== undefined ? strOrNull(body.address) : existing.address,
      contactPerson: body.contactPerson !== undefined ? strOrNull(body.contactPerson) : existing.contactPerson,
      phone: body.phone !== undefined ? strOrNull(body.phone) : existing.phone,
      workingHours: body.workingHours !== undefined ? strOrNull(body.workingHours) : existing.workingHours,
      latitude: body.latitude !== undefined ? parseCoord(body.latitude) : existing.latitude,
      longitude: body.longitude !== undefined ? parseCoord(body.longitude) : existing.longitude,
    },
  })
  return NextResponse.json(branch)
}

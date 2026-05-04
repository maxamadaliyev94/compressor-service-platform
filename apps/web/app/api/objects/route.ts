import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { canReadClientScope, getBranchClientId, type AuthedSession } from '@/lib/api-access'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const branchId = req.nextUrl.searchParams.get('branchId')
  if (!branchId) return NextResponse.json([])

  const clientId = await getBranchClientId(branchId)
  if (!clientId) return NextResponse.json([])

  const ok = await canReadClientScope(session as AuthedSession, clientId)
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const objects = await db.object.findMany({ where: { branchId }, orderBy: { name: 'asc' } })
  return NextResponse.json(objects)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = session.user.role
  if (!['ADMIN', 'MANAGER', 'CHIEF_ENGINEER'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const branchId = typeof body.branchId === 'string' ? body.branchId : ''
  if (!branchId) return NextResponse.json({ error: 'branchId обязателен' }, { status: 400 })

  const clientId = await getBranchClientId(branchId)
  if (!clientId) return NextResponse.json({ error: 'Филиал не найден' }, { status: 404 })

  const ok = await canReadClientScope(session as AuthedSession, clientId)
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const object = await db.object.create({
    data: {
      branchId,
      name: body.name,
      description: body.description || null,
      contactPerson: body.contactPerson || null,
    },
  })
  return NextResponse.json(object)
}

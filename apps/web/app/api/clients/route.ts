import { db } from '@/lib/db'
import { auth } from '@/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = session.user.role
  if (!['ADMIN', 'MANAGER'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const client = await db.client.create({
    data: {
      name: body.name,
      inn: body.inn || null,
      contactPerson: body.contactPerson || null,
      phone: body.phone || null,
      email: body.email || null,
      status: body.status || 'STANDART',
      country: body.country || 'Узбекистан',
      city: body.city || null,
      comment: body.comment || null,
    },
  })
  return NextResponse.json(client)
}

export async function GET() {
  const clients = await db.client.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(clients)
}

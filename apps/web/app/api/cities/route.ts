import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'CLIENT') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const cities = await db.city.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json(cities)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'MANAGER', 'CHIEF_ENGINEER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Название обязательно' }, { status: 400 })

  const trimmed = name.trim()
  const agg = await db.city.aggregate({ _max: { sortOrder: true } })
  const sortOrder = (agg._max.sortOrder ?? -1) + 1

  try {
    const city = await db.city.create({
      data: { name: trimmed, sortOrder },
    })
    return NextResponse.json(city)
  } catch {
    return NextResponse.json({ error: 'Такой город уже существует' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id обязателен' }, { status: 400 })
  await db.city.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

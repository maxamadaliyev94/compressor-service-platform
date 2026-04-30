import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function GET() {
  const brands = await db.equipmentBrandRef.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' }
  })
  return NextResponse.json(brands)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Название обязательно' }, { status: 400 })

  try {
    const brand = await db.equipmentBrandRef.create({
      data: { name: name.trim() }
    })
    return NextResponse.json(brand)
  } catch (e) {
    return NextResponse.json({ error: 'Такой бренд уже существует' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await req.json()
  await db.equipmentBrandRef.update({ where: { id }, data: { isActive: false } })
  return NextResponse.json({ ok: true })
}

import { db } from '@/lib/db'
import { auth } from '@/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'CLIENT') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const types = await db.equipmentTypeRef.findMany({
    where: { isActive: true },
    orderBy: [{ isSystem: 'desc' }, { nameRu: 'asc' }],
  })
  return NextResponse.json(types)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { nameRu } = await req.json()
  const label = String(nameRu || '').trim()
  if (!label) {
    return NextResponse.json({ error: 'Название обязательно' }, { status: 400 })
  }

  const unique = 'CUSTOM_' + Date.now().toString()

  try {
    const created = await db.equipmentTypeRef.create({
      data: {
        name: unique,
        nameRu: label,
        isSystem: false,
      },
    })
    return NextResponse.json(created)
  } catch {
    return NextResponse.json({ error: 'Такой тип уже существует' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await req.json()
  const current = await db.equipmentTypeRef.findUnique({ where: { id } })
  if (!current) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (current.isSystem) {
    return NextResponse.json({ error: 'Системный тип удалить нельзя' }, { status: 400 })
  }

  await db.equipmentTypeRef.update({
    where: { id },
    data: { isActive: false },
  })

  return NextResponse.json({ ok: true })
}

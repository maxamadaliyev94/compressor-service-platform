import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

function canManageWorkTypes(role?: string) {
  return role === 'ADMIN' || role === 'MANAGER' || role === 'CHIEF_ENGINEER'
}

function makeCustomCode(): string {
  return `CUSTOM_${Date.now().toString(36)}`
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'CLIENT') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const types = await db.workTypeRef.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { nameRu: 'asc' }],
  })
  return NextResponse.json(types)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageWorkTypes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const nameRu = typeof body.nameRu === 'string' ? body.nameRu.trim() : ''
  if (!nameRu) return NextResponse.json({ error: 'Название обязательно' }, { status: 400 })

  const agg = await db.workTypeRef.aggregate({ _max: { sortOrder: true } })
  const sortOrder = (agg._max.sortOrder ?? -1) + 1

  try {
    const created = await db.workTypeRef.create({
      data: {
        code: makeCustomCode(),
        nameRu,
        isSystem: false,
        sortOrder,
      },
    })
    return NextResponse.json(created)
  } catch {
    return NextResponse.json({ error: 'Не удалось создать тип работы' }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageWorkTypes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const id = typeof body.id === 'string' ? body.id : ''
  if (!id) return NextResponse.json({ error: 'id обязателен' }, { status: 400 })

  const current = await db.workTypeRef.findUnique({ where: { id } })
  if (!current || !current.isActive) {
    return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
  }

  const nameRu =
    typeof body.nameRu === 'string' && body.nameRu.trim() ? body.nameRu.trim() : undefined
  const sortOrder =
    body.sortOrder === undefined || body.sortOrder === null
      ? undefined
      : Number.parseInt(String(body.sortOrder), 10)

  if (nameRu === undefined && sortOrder === undefined) {
    return NextResponse.json({ error: 'Нечего обновлять' }, { status: 400 })
  }

  const updated = await db.workTypeRef.update({
    where: { id },
    data: {
      ...(nameRu !== undefined ? { nameRu } : {}),
      ...(sortOrder !== undefined && Number.isFinite(sortOrder) ? { sortOrder } : {}),
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const id = typeof body.id === 'string' ? body.id : ''
  if (!id) return NextResponse.json({ error: 'id обязателен' }, { status: 400 })

  const current = await db.workTypeRef.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
  if (current.isSystem) {
    return NextResponse.json({ error: 'Системный тип удалить нельзя' }, { status: 400 })
  }

  const used = await db.maintenanceRegulation.count({
    where: { taskType: current.code, isActive: true },
  })
  if (used > 0) {
    return NextResponse.json(
      { error: `Тип используется в ${used} чек-лист(ах). Сначала измените или удалите их.` },
      { status: 400 },
    )
  }

  await db.workTypeRef.update({ where: { id }, data: { isActive: false } })
  return NextResponse.json({ ok: true })
}

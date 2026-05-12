import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getEquipmentClientId } from '@/lib/api-access'
import { MAX_EQUIPMENT_PHOTOS } from '@/lib/photo-limits'
import { Prisma } from '@prisma/client'

async function assertCanMutateEquipment(session: {
  user: { id: string; role: string }
}, equipmentId: string) {
  if (!['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (session.user.role === 'MANAGER') {
    const cid = await getEquipmentClientId(equipmentId)
    if (!cid) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const c = await db.client.findUnique({ where: { id: cid }, select: { managerId: true } })
    if (c?.managerId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const forbidden = await assertCanMutateEquipment(session, params.id)
  if (forbidden) return forbidden

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object' || !Array.isArray((body as { photos?: unknown }).photos)) {
    return NextResponse.json({ error: 'Ожидается массив photos' }, { status: 400 })
  }

  const photos = (body as { photos: unknown[] }).photos
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    .slice(0, MAX_EQUIPMENT_PHOTOS)

  const eq = await db.equipment.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!eq) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.$transaction(async (tx) => {
    await tx.equipmentPhoto.deleteMany({ where: { equipmentId: params.id } })
    if (photos.length > 0) {
      await tx.equipmentPhoto.createMany({
        data: photos.map((url) => ({ equipmentId: params.id, url: url.trim() })),
      })
    }
  })

  const updated = await db.equipment.findUnique({
    where: { id: params.id },
    include: { photos: { orderBy: { createdAt: 'desc' } } },
  })

  return NextResponse.json(updated)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (session.user.role === 'MANAGER') {
    const cid = await getEquipmentClientId(params.id)
    if (!cid) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const c = await db.client.findUnique({ where: { id: cid }, select: { managerId: true } })
    if (c?.managerId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const yearRaw = body.yearOfManufacture
  const yearParsed =
    yearRaw === '' || yearRaw === null || yearRaw === undefined
      ? null
      : Number.parseInt(String(yearRaw), 10)
  const yearOfManufacture =
    yearParsed !== null && Number.isFinite(yearParsed) ? yearParsed : null

  const pressureRaw = (body as { pressureBar?: unknown }).pressureBar
  const pressureBar =
    pressureRaw === '' || pressureRaw === null || pressureRaw === undefined
      ? null
      : (() => {
          const n = Number(pressureRaw)
          return Number.isFinite(n) ? n : null
        })()

  try {
    const equipment = await db.equipment.update({
      where: { id: params.id },
      data: {
        brand: String(body.brand ?? ''),
        model: String(body.model ?? ''),
        type: body.type,
        serialNumber: String(body.serialNumber ?? ''),
        yearOfManufacture,
        installDate: body.installDate ? new Date(body.installDate) : null,
        pressureBar,
        currentHours: Number(body.currentHours) || 0,
        nextServiceHours:
          body.nextServiceHours === '' || body.nextServiceHours === null || body.nextServiceHours === undefined
            ? null
            : Number.parseInt(String(body.nextServiceHours), 10),
        warrantyUntil: body.warrantyUntil ? new Date(body.warrantyUntil) : null,
        status: body.status,
        notes: body.notes ?? null,
      },
    })
    return NextResponse.json(equipment)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json(
        { error: 'Этот серийный номер уже используется другим оборудованием' },
        { status: 409 }
      )
    }
    throw e
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (session.user.role === 'MANAGER') {
    const cid = await getEquipmentClientId(params.id)
    if (!cid) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const c = await db.client.findUnique({ where: { id: cid }, select: { managerId: true } })
    if (c?.managerId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const eq = await db.equipment.findUnique({
    where: { id: params.id },
    include: {
      tasks: {
        where: {
          deletedAt: null,
          status: { notIn: ['DONE', 'CANCELLED'] },
        },
        select: { id: true },
      },
    },
  })
  if (!eq) return NextResponse.json({ error: 'Оборудование не найдено' }, { status: 404 })
  if (eq.tasks.length > 0) {
    return NextResponse.json(
      { error: 'Нельзя удалить оборудование с существующими задачами. Сначала удалите или перенесите задачи.' },
      { status: 400 }
    )
  }

  await db.$transaction(async (tx) => {
    // Удаляем отчёты перед задачами: у WorkReport -> ServiceTask связь без каскадного удаления.
    await tx.workReport.deleteMany({
      where: { task: { equipmentId: params.id } },
    })

    await tx.serviceTask.deleteMany({
      where: { equipmentId: params.id },
    })

    await tx.equipment.delete({ where: { id: params.id } })
  })

  return NextResponse.json({ ok: true })
}

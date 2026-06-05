import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { assertActiveEquipmentTypeCode } from '@/lib/equipment-types'
import { assertActiveWorkTypeCode } from '@/lib/work-types'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'CLIENT') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const regulations = await db.maintenanceRegulation.findMany({
    where: { isActive: true },
    include: { items: { orderBy: { order: 'asc' } } },
    orderBy: { name: 'asc' }
  })
  return NextResponse.json(regulations)
}

function canManageRegulations(role?: string) {
  return role === 'ADMIN' || role === 'MANAGER'
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !canManageRegulations(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json()
  const taskType = String(body.taskType || 'PLANNED_MAINTENANCE')
  const equipmentType = String(body.equipmentType || 'COMPRESSOR')
  if (!(await assertActiveWorkTypeCode(taskType))) {
    return NextResponse.json({ error: 'Неизвестный тип работы' }, { status: 400 })
  }
  if (!(await assertActiveEquipmentTypeCode(equipmentType))) {
    return NextResponse.json({ error: 'Неизвестный тип оборудования' }, { status: 400 })
  }
  const taskScope = body.taskScope === 'LONG_TERM' ? 'LONG_TERM' : 'QUICK'

  const regulation = await db.maintenanceRegulation.create({
    data: {
      name: body.name,
      equipmentType,
      intervalHours: parseInt(body.intervalHours) || 0,
      taskType,
      taskScope,
      description: body.description || null,
      items: {
        create: (body.items || []).map((item: any, i: number) => ({
          label: item.label,
          itemType: item.itemType || 'CONTROL',
          order: i,
          isRequired: item.isRequired !== false,
        }))
      }
    },
    include: { items: true }
  })
  return NextResponse.json(regulation)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session || !canManageRegulations(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await req.json()) as {
    id?: string
    name?: string
    equipmentType?: string
    intervalHours?: number | string
    taskType?: string
    taskScope?: string
    description?: string | null
    items?: Array<{ label: string; itemType?: string; isRequired?: boolean }>
  }

  if (!body.id) {
    return NextResponse.json({ error: 'Regulation id is required' }, { status: 400 })
  }

  if (body.taskType !== undefined) {
    const taskType = String(body.taskType)
    if (!(await assertActiveWorkTypeCode(taskType))) {
      return NextResponse.json({ error: 'Неизвестный тип работы' }, { status: 400 })
    }
  }
  if (body.equipmentType !== undefined) {
    const equipmentType = String(body.equipmentType)
    if (!(await assertActiveEquipmentTypeCode(equipmentType))) {
      return NextResponse.json({ error: 'Неизвестный тип оборудования' }, { status: 400 })
    }
  }

  const updated = await db.$transaction(async (tx) => {
    const regulation = await tx.maintenanceRegulation.update({
      where: { id: body.id },
      data: {
        name: body.name,
        equipmentType: body.equipmentType === undefined ? undefined : String(body.equipmentType),
        intervalHours:
          body.intervalHours === undefined ? undefined : parseInt(String(body.intervalHours), 10) || 0,
        taskType: body.taskType === undefined ? undefined : String(body.taskType),
        taskScope:
          body.taskScope === undefined
            ? undefined
            : body.taskScope === 'LONG_TERM'
              ? 'LONG_TERM'
              : 'QUICK',
        description: body.description ?? null,
      },
    })

    if (Array.isArray(body.items)) {
      await tx.maintenanceRegulationItem.deleteMany({
        where: { regulationId: body.id },
      })
      if (body.items.length > 0) {
        await tx.maintenanceRegulationItem.createMany({
          data: body.items.map((item, index) => ({
            regulationId: body.id as string,
            label: item.label,
            itemType: (item.itemType as any) || 'CONTROL',
            order: index,
            isRequired: item.isRequired !== false,
          })),
        })
      }
    }

    return regulation
  })

  const withItems = await db.maintenanceRegulation.findUnique({
    where: { id: updated.id },
    include: { items: { orderBy: { order: 'asc' } } },
  })

  return NextResponse.json(withItems)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session || !canManageRegulations(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await req.json()) as { id?: string }
  if (!body.id) {
    return NextResponse.json({ error: 'Regulation id is required' }, { status: 400 })
  }

  await db.maintenanceRegulation.update({
    where: { id: body.id },
    data: { isActive: false },
  })

  return NextResponse.json({ ok: true })
}

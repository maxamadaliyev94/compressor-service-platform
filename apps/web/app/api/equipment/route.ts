import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { hasPermission } from '@/lib/permissions'
import { canReadClientScope, type AuthedSession } from '@/lib/api-access'
import type { Role } from '@prisma/client'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const s = session as AuthedSession
  const role = s.user.role
  const clientIdParam = req.nextUrl.searchParams.get('clientId')

  let where: Parameters<typeof db.equipment.findMany>[0]['where'] = undefined

  if (role === 'CLIENT') {
    if (!s.user.clientId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    where = { object: { branch: { clientId: s.user.clientId } } }
  } else if (role === 'ENGINEER') {
    if (clientIdParam) {
      const ok = await canReadClientScope(s, clientIdParam)
      if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      where = { object: { branch: { clientId: clientIdParam } } }
    } else {
      const taskRows = await db.serviceTask.findMany({
        where: {
          assignedToId: s.user.id,
          deletedAt: null,
        },
        select: { equipmentId: true },
      })
      const ids = [...new Set(taskRows.map((t) => t.equipmentId))]
      if (ids.length === 0) return NextResponse.json([])
      where = { id: { in: ids } }
    }
  } else if (role === 'MANAGER') {
    if (clientIdParam) {
      const ok = await canReadClientScope(s, clientIdParam)
      if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      where = { object: { branch: { clientId: clientIdParam } } }
    } else {
      where = { object: { branch: { client: { managerId: s.user.id } } } }
    }
  } else if (role === 'ADMIN' || role === 'CHIEF_ENGINEER') {
    if (clientIdParam) {
      where = { object: { branch: { clientId: clientIdParam } } }
    } else {
      where = {
        object: {
          branch: {
            client: { status: { not: 'PASSIVE' } },
          },
        },
      }
    }
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const equipment = await db.equipment.findMany({
    where,
    include: { object: { include: { branch: { include: { client: true } } } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(equipment)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = session.user.role as Role
  const canCreate = await hasPermission(role, 'action:equipment.create')
  if (!canCreate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const objectId = typeof body.objectId === 'string' ? body.objectId : ''
  if (!objectId) return NextResponse.json({ error: 'objectId обязателен' }, { status: 400 })

  const branchClient = await db.object.findUnique({
    where: { id: objectId },
    select: { branchId: true, branch: { select: { clientId: true, client: { select: { managerId: true } } } } },
  })
  if (!branchClient) return NextResponse.json({ error: 'Объект не найден' }, { status: 404 })

  const clientId = branchClient.branch.clientId
  if (role === 'MANAGER' && branchClient.branch.client.managerId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (role === 'ENGINEER' || role === 'CLIENT') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const photos = Array.isArray(body.photos)
    ? body.photos.filter((p: unknown): p is string => typeof p === 'string' && p.length > 0).slice(0, 10)
    : []
  const nextServiceHours = (body.currentHours || 0) + 2000
  const equipment = await db.equipment.create({
    data: {
      objectId,
      type: body.type,
      brand: body.brand,
      model: body.model,
      serialNumber: body.serialNumber,
      yearOfManufacture: body.yearOfManufacture || null,
      installDate: body.installDate ? new Date(body.installDate) : null,
      warrantyUntil: body.warrantyUntil ? new Date(body.warrantyUntil) : null,
      currentHours: body.currentHours || 0,
      nextServiceHours,
      photos: photos.length > 0 ? { create: photos.map((url) => ({ url })) } : undefined,
    },
    include: { photos: true },
  })
  return NextResponse.json(equipment)
}

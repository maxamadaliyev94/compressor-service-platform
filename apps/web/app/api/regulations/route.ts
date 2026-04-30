import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function GET() {
  const regulations = await db.maintenanceRegulation.findMany({
    where: { isActive: true },
    include: { items: { orderBy: { order: 'asc' } } },
    orderBy: { name: 'asc' }
  })
  return NextResponse.json(regulations)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json()
  const regulation = await db.maintenanceRegulation.create({
    data: {
      name: body.name,
      equipmentType: body.equipmentType || 'COMPRESSOR',
      intervalHours: parseInt(body.intervalHours) || 0,
      taskType: body.taskType || 'PLANNED_MAINTENANCE',
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

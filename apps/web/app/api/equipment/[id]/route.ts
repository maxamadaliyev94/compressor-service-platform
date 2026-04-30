import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const equipment = await db.equipment.update({
    where: { id: params.id },
    data: {
      brand: body.brand,
      model: body.model,
      type: body.type,
      currentHours: parseInt(body.currentHours) || 0,
      nextServiceHours: body.nextServiceHours ? parseInt(body.nextServiceHours) : undefined,
      warrantyUntil: body.warrantyUntil ? new Date(body.warrantyUntil) : null,
      status: body.status,
      notes: body.notes || null,
    },
  })
  return NextResponse.json(equipment)
}

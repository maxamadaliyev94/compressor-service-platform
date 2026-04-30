import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  const equipment = await db.equipment.findMany({
    where: clientId
      ? {
          object: { branch: { clientId } },
        }
      : undefined,
    include: { object: { include: { branch: { include: { client: true } } } } },
  })
  return NextResponse.json(equipment)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const nextServiceHours = (body.currentHours || 0) + 2000
  const equipment = await db.equipment.create({
    data: {
      objectId: body.objectId,
      type: body.type,
      brand: body.brand,
      model: body.model,
      serialNumber: body.serialNumber,
      yearOfManufacture: body.yearOfManufacture || null,
      installDate: body.installDate ? new Date(body.installDate) : null,
      warrantyUntil: body.warrantyUntil ? new Date(body.warrantyUntil) : null,
      currentHours: body.currentHours || 0,
      nextServiceHours,
    },
  })
  return NextResponse.json(equipment)
}

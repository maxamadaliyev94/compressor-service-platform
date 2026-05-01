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
  const photos = Array.isArray(body.photos)
    ? body.photos
        .filter((p: unknown): p is string => typeof p === 'string' && p.length > 0)
        .slice(0, 10)
    : []
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
      photos: photos.length > 0 ? { create: photos.map((url) => ({ url })) } : undefined,
    },
    include: { photos: true },
  })
  return NextResponse.json(equipment)
}

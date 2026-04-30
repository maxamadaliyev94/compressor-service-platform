import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const branchId = req.nextUrl.searchParams.get('branchId')
  if (!branchId) return NextResponse.json([])
  const objects = await db.object.findMany({ where: { branchId } })
  return NextResponse.json(objects)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const object = await db.object.create({
    data: {
      branchId: body.branchId,
      name: body.name,
      description: body.description || null,
      contactPerson: body.contactPerson || null,
    },
  })
  return NextResponse.json(object)
}

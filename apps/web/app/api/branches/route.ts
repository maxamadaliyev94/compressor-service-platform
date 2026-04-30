import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return NextResponse.json([])
  const branches = await db.branch.findMany({ where: { clientId } })
  return NextResponse.json(branches)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const branch = await db.branch.create({
    data: {
      clientId: body.clientId,
      name: body.name,
      address: body.address || null,
      latitude: body.latitude ? parseFloat(body.latitude) : null,
      longitude: body.longitude ? parseFloat(body.longitude) : null,
      contactPerson: body.contactPerson || null,
      phone: body.phone || null,
      workingHours: body.workingHours || null,
    },
  })
  return NextResponse.json(branch)
}

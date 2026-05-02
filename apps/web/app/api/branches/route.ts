import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return NextResponse.json([])
  const branches = await db.branch.findMany({ where: { clientId } })
  return NextResponse.json(branches)
}

function parseCoord(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const branch = await db.branch.create({
    data: {
      clientId: body.clientId,
      name: body.name,
      address: body.address || null,
      latitude: parseCoord(body.latitude),
      longitude: parseCoord(body.longitude),
      contactPerson: body.contactPerson || null,
      phone: body.phone || null,
      workingHours: body.workingHours || null,
    },
  })
  return NextResponse.json(branch)
}

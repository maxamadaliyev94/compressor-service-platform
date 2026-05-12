import { db } from '@/lib/db'
import { verifySuperadminBasicAuth } from '@/lib/superadmin-basic-auth'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  if (!verifySuperadminBasicAuth(req)) {
    return new NextResponse(null, {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Superadmin"' },
    })
  }

  const current = await db.appSettings.findUnique({ where: { id: 'default' } })
  const nextActive = !(current?.isActive ?? true)

  await db.appSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', isActive: nextActive },
    update: { isActive: nextActive },
  })

  return NextResponse.json({ active: nextActive })
}

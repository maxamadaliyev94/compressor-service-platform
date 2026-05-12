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
  const prevActive = current?.isActive ?? true
  const nextActive = !prevActive

  console.log('[api/superadmin/toggle] before write', {
    rowExists: !!current,
    isActiveInDb: current?.isActive,
    computedNextActive: nextActive,
  })

  await db.appSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', isActive: nextActive },
    update: { isActive: nextActive },
  })

  const after = await db.appSettings.findUnique({ where: { id: 'default' } })
  console.log('[api/superadmin/toggle] after write', {
    isActiveInDb: after?.isActive,
    responseActive: nextActive,
  })

  return NextResponse.json({ active: nextActive })
}

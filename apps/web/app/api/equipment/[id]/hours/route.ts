import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { currentHours, reason, comment } = await req.json()

  const equipment = await db.equipment.findUnique({ where: { id: params.id } })
  if (!equipment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'UPDATE_HOURS',
      entity: 'Equipment',
      entityId: params.id,
      oldValue: String(equipment.currentHours),
      newValue: String(currentHours),
      comment: [reason, comment].filter(Boolean).join(' · ') || null,
    }
  })

  const updated = await db.equipment.update({
    where: { id: params.id },
    data: { currentHours }
  })

  return NextResponse.json(updated)
}

import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { canMutateEquipment, type AuthedSession } from '@/lib/api-access'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = await canMutateEquipment(session as AuthedSession, params.id)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { currentHours, reason, comment, hoursPerDay, daysPerWeek } = await req.json()
  const parsedCurrentHours = Number(currentHours)
  const parsedHoursPerDay = hoursPerDay === '' || hoursPerDay === null || hoursPerDay === undefined ? null : Number(hoursPerDay)
  const parsedDaysPerWeek = daysPerWeek === '' || daysPerWeek === null || daysPerWeek === undefined ? null : Number(daysPerWeek)

  if (!Number.isFinite(parsedCurrentHours) || parsedCurrentHours < 0) {
    return NextResponse.json({ error: 'Invalid currentHours' }, { status: 400 })
  }
  if (parsedHoursPerDay !== null && (!Number.isFinite(parsedHoursPerDay) || parsedHoursPerDay < 0)) {
    return NextResponse.json({ error: 'Invalid hoursPerDay' }, { status: 400 })
  }
  if (parsedDaysPerWeek !== null && (!Number.isFinite(parsedDaysPerWeek) || parsedDaysPerWeek < 0 || parsedDaysPerWeek > 7)) {
    return NextResponse.json({ error: 'Invalid daysPerWeek' }, { status: 400 })
  }

  const equipment = await db.equipment.findUnique({ where: { id: params.id } })
  if (!equipment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'UPDATE_HOURS',
      entity: 'Equipment',
      entityId: params.id,
      oldValue: String(equipment.currentHours),
      newValue: String(parsedCurrentHours),
      comment: [reason, comment].filter(Boolean).join(' · ') || null,
    }
  })

  const updated = await db.equipment.update({
    where: { id: params.id },
    data: {
      currentHours: parsedCurrentHours,
      hoursPerDay: parsedHoursPerDay,
      daysPerWeek: parsedDaysPerWeek,
    }
  })

  return NextResponse.json(updated)
}

import { db } from '@/lib/db'

function roundToThree(n: number): number {
  return Math.round(n * 1000) / 1000
}

export async function runAutoHoursUpdate() {
  const cronActor = await db.user.findFirst({
    where: {
      isActive: true,
      role: { in: ['ADMIN', 'CHIEF_ENGINEER', 'MANAGER'] },
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!cronActor) {
    return { ok: false as const, updated: 0, skipped: 0, error: 'Нет активного пользователя для AuditLog' }
  }

  const equipmentList = await db.equipment.findMany({
    where: {
      hoursPerDay: { not: null },
      daysPerWeek: { not: null },
    },
    select: {
      id: true,
      currentHours: true,
      hoursPerDay: true,
      daysPerWeek: true,
    },
  })

  let updated = 0
  let skipped = 0

  for (const eq of equipmentList) {
    const hpd = Number(eq.hoursPerDay ?? 0)
    const dpw = Number(eq.daysPerWeek ?? 0)
    if (!Number.isFinite(hpd) || !Number.isFinite(dpw) || hpd <= 0 || dpw <= 0) {
      skipped++
      continue
    }

    const increment = (hpd * dpw) / 7 / 24
    const next = roundToThree(eq.currentHours + increment)

    await db.$transaction([
      db.equipment.update({
        where: { id: eq.id },
        data: { currentHours: next },
      }),
      db.auditLog.create({
        data: {
          userId: cronActor.id,
          action: 'AUTO_UPDATE_HOURS',
          entity: 'Equipment',
          entityId: eq.id,
          oldValue: String(eq.currentHours),
          newValue: String(next),
          comment: `Автоматическое обновление · режим ${hpd}ч/д × ${dpw}д/нед`,
        },
      }),
    ])
    updated++
  }

  return { ok: true as const, updated, skipped }
}


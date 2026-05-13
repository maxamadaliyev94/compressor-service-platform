import { APP_TIMEZONE } from '@/lib/app-timezone'

const BURST_ACTIONS = new Set([
  'CLIENT_DELETE',
  'TASK_DELETE',
  'TASK_TRASH_PURGE',
  'ACCESS_RESET',
  'EQUIPMENT_DELETE',
])

function hourInTz(d: Date): number {
  return parseInt(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: APP_TIMEZONE,
      hour: 'numeric',
      hour12: false,
    }).format(d),
    10,
  )
}

export function isNightActivity(d: Date): boolean {
  const h = hourInTz(d)
  return h >= 23 || h < 6
}

export type ActivityRowLite = { userId: string; action: string; createdAt: Date }

/** ≥5 удалений/сбросов за 10 минут до этой записи (включительно), тот же пользователь. */
export function burstDeleteFlag(row: ActivityRowLite, all: ActivityRowLite[]): boolean {
  if (!BURST_ACTIONS.has(row.action)) return false
  const t0 = row.createdAt.getTime() - 10 * 60 * 1000
  const t1 = row.createdAt.getTime()
  let n = 0
  for (const o of all) {
    if (o.userId !== row.userId) continue
    if (!BURST_ACTIONS.has(o.action)) continue
    const t = o.createdAt.getTime()
    if (t > t0 && t <= t1) n++
  }
  return n >= 5
}

export function nightLoginFlag(row: ActivityRowLite): boolean {
  return row.action === 'LOGIN' && isNightActivity(row.createdAt)
}

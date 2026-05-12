/** Ключ календарного дня в UTC: YYYYMMDD */
function utcCalendarKey(d: Date): number {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
}

/** Сегодня (UTC) строго позже последнего дня подписки — доступ по подписке закрыт. */
export function isSubscriptionEndPassedUTC(subscriptionEnd: Date | null | undefined): boolean {
  if (!subscriptionEnd) return false
  return utcCalendarKey(new Date()) > utcCalendarKey(subscriptionEnd)
}

export type AppAccessRow = {
  isActive: boolean
  subscriptionEnd: Date | null
}

/** Доступ в приложение: включённый флаг и не истёк срок подписки. */
export function computeGloballyAccessible(row: AppAccessRow | null): boolean {
  if (!row) return true
  if (row.isActive === false) return false
  if (isSubscriptionEndPassedUTC(row.subscriptionEnd)) return false
  return true
}

/** Оставшиеся дни подписки включительно (последний день — ещё 1 день). null если даты конца нет. */
export function subscriptionDaysRemainingInclusive(
  subscriptionEnd: Date | null | undefined,
  now = new Date(),
): number | null {
  if (!subscriptionEnd) return null
  const endMs = Date.UTC(
    subscriptionEnd.getUTCFullYear(),
    subscriptionEnd.getUTCMonth(),
    subscriptionEnd.getUTCDate(),
  )
  const nowMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const diffDays = Math.round((endMs - nowMs) / 86400000)
  if (diffDays < 0) return 0
  return diffDays + 1
}

/** Для поля type="date" (YYYY-MM-DD) из Date @db.Date */
export function toDateInputValueUTC(d: Date | null | undefined): string {
  if (!d) return ''
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Из строки input type="date" в Date UTC полуночи того календарного дня (хранение как DATE). */
export function parseDateInputUtc(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null
  const [y, m, d] = value.trim().split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

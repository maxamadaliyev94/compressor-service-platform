/** Поля для отображения срока в списках и карточках */
export type TaskScheduleFields = {
  taskType?: string | null
  status: string
  scheduledAt?: Date | null
  startDate?: Date | null
  endDate?: Date | null
}

export function atUtcMidnight(d: Date): Date {
  const x = new Date(d)
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()))
}

/** Все календарные дни UTC от a до b включительно (a ≤ b). */
export function* eachUtcDateInclusive(a: Date, b: Date): Generator<string> {
  const t0 = atUtcMidnight(a).getTime()
  const t1 = atUtcMidnight(b).getTime()
  for (let t = t0; t <= t1; t += 86400000) {
    yield new Date(t).toISOString().slice(0, 10)
  }
}

/** Текст периода для уведомлений: «с ДД.ММ.ГГГГ по ДД.ММ.ГГГГ» */
export function formatLongTermNotifyPeriod(start: Date | null, end: Date | null): string {
  if (start && end) return `с ${formatDateRu(start)} по ${formatDateRu(end)}`
  if (start) return `с ${formatDateRu(start)}`
  if (end) return `по ${formatDateRu(end)}`
  return ''
}

export function formatDateRu(d: Date): string {
  return atUtcMidnight(d).toLocaleDateString('ru-RU', { timeZone: 'UTC' })
}

/** Текст срока: для LONG_TERM — «дд.мм.гггг — дд.мм.гггг», иначе одна дата по scheduledAt */
export function formatTaskScheduleRangeRu(task: TaskScheduleFields): string {
  if (task.taskType === 'LONG_TERM') {
    const a = task.startDate ? formatDateRu(new Date(task.startDate)) : null
    const b = task.endDate ? formatDateRu(new Date(task.endDate)) : null
    if (a && b) return `${a} — ${b}`
    if (a) return `${a} — …`
    if (b) return `— ${b}`
    return '—'
  }
  if (task.scheduledAt) return formatDateRu(new Date(task.scheduledAt))
  return '—'
}

/** Просрочен плановый срок окончания (только активные долгосрочные). */
export function isTaskEndDateOverdue(task: TaskScheduleFields): boolean {
  if (task.taskType !== 'LONG_TERM' || !task.endDate) return false
  if (['DONE', 'CANCELLED'].includes(task.status)) return false
  const end = atUtcMidnight(new Date(task.endDate))
  const today = new Date()
  const t0 = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  return end < t0
}

/** Дата для фильтра «год/месяц/день» в списке задач */
export function taskCalendarAnchorDate(task: TaskScheduleFields): Date | null {
  if (task.taskType === 'LONG_TERM') {
    if (task.endDate) return new Date(task.endDate)
    if (task.startDate) return new Date(task.startDate)
    return null
  }
  return task.scheduledAt ? new Date(task.scheduledAt) : null
}

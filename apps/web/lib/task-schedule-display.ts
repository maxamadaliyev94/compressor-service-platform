/** Поля для отображения срока в списках и карточках */
export type TaskScheduleFields = {
  taskType?: string | null
  status: string
  scheduledAt?: Date | null
  startDate?: Date | null
  endDate?: Date | null
}

function atUtcMidnight(d: Date): Date {
  const x = new Date(d)
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()))
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

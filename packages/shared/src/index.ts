// ─── Константы ТО ────────────────────────────────────────────────────────────
export const MAINTENANCE_INTERVAL = 2000   // моточасы между плановыми ТО
export const WARNING_THRESHOLD    = 300    // осталось м/ч — жёлтый статус
export const URGENT_THRESHOLD     = 100    // осталось м/ч — красный статус
export const WARRANTY_EXPIRING_DAYS = 30   // дней до окончания гарантии

// ─── Статусы ТО ───────────────────────────────────────────────────────────────
export type MaintenanceStatus = 'NORMAL' | 'WARNING' | 'URGENT' | 'OVERDUE'

export function getMaintenanceStatus(
  currentHours: number,
  nextServiceHours: number
): MaintenanceStatus {
  const diff = nextServiceHours - currentHours
  if (diff < 0)   return 'OVERDUE'
  if (diff < URGENT_THRESHOLD)  return 'URGENT'
  if (diff < WARNING_THRESHOLD) return 'WARNING'
  return 'NORMAL'
}

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  NORMAL:  'Норма',
  WARNING: 'Скоро ТО',
  URGENT:  'Срочно ТО',
  OVERDUE: 'Просрочено',
}

// ─── Статусы гарантии ─────────────────────────────────────────────────────────
export type WarrantyStatus = 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'VOIDED'

export function getWarrantyStatus(
  warrantyUntil: Date | null,
  isVoided: boolean
): WarrantyStatus {
  if (isVoided) return 'VOIDED'
  if (!warrantyUntil) return 'EXPIRED'
  const msLeft = warrantyUntil.getTime() - Date.now()
  const daysLeft = msLeft / (1000 * 60 * 60 * 24)
  if (daysLeft < 0) return 'EXPIRED'
  if (daysLeft <= WARRANTY_EXPIRING_DAYS) return 'EXPIRING'
  return 'ACTIVE'
}

export const WARRANTY_STATUS_LABELS: Record<WarrantyStatus, string> = {
  ACTIVE:   'На гарантии',
  EXPIRING: 'Гарантия скоро заканчивается',
  EXPIRED:  'Гарантия закончилась',
  VOIDED:   'Гарантия аннулирована',
}

// ─── Типы задач ───────────────────────────────────────────────────────────────
export type TaskType =
  | 'PLANNED_MAINTENANCE'
  | 'DIAGNOSTICS'
  | 'WARRANTY_REPAIR'
  | 'EMERGENCY'
  | 'INSTALLATION'
  | 'COMMISSIONING'

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  PLANNED_MAINTENANCE: 'Плановое ТО',
  DIAGNOSTICS:         'Диагностика',
  WARRANTY_REPAIR:     'Гарантийный ремонт',
  EMERGENCY:           'Аварийный выезд',
  INSTALLATION:        'Монтаж',
  COMMISSIONING:       'Пусконаладка',
}

// ─── Статусы задачи ───────────────────────────────────────────────────────────
export type TaskStatus =
  | 'NEW'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'DRAFT'
  | 'REVIEW'
  | 'DONE'
  | 'REVISION'
  | 'CANCELLED'

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  NEW:         'Новая',
  ASSIGNED:    'Назначена',
  IN_PROGRESS: 'В работе',
  DRAFT:       'Черновик',
  REVIEW:      'На проверке',
  DONE:        'Выполнено',
  REVISION:    'Требует доработки',
  CANCELLED:   'Отменена',
}

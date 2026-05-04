import type { ChecklistItemAction } from '@prisma/client'

/** Совпадает с пунктами блока «Тип работ (авто)» в мастере — для них действие не выбирается. */
const DIAGNOSTICS_AUTO_ROW_LABELS = new Set([
  'Плановое ТО',
  'Диагностика',
  'Ремонт',
  'Гарантийный ремонт',
  'Монтаж',
  'Пусконаладка',
])

export function isDiagnosticsChecklistAutoRowLabel(label: string): boolean {
  return DIAGNOSTICS_AUTO_ROW_LABELS.has(label.trim())
}

/** Нужно ли для отмеченного пункта диагностики сохранить performedAction. */
export function needsDiagnosticsPerformedAction(row: {
  checked: boolean
  label: string
  isAuto?: boolean
}): boolean {
  if (!row.checked) return false
  if (row.isAuto) return false
  if (isDiagnosticsChecklistAutoRowLabel(row.label)) return false
  return true
}

/** Пункты вроде «масло», но не «масляный фильтр» — действия Заменить / Долить. */
export function isDiagnosticsOilPrimaryItemLabel(label: string): boolean {
  const l = label.toLowerCase()
  return l.includes('масло') && !l.includes('маслян')
}

export const CHECKLIST_ACTION_LABELS: Record<ChecklistItemAction, string> = {
  REPLACE: 'Заменить',
  TOP_UP: 'Долить',
  REPAIR: 'Ремонт',
}

export function checklistActionLabelRu(action: ChecklistItemAction | string | null | undefined): string {
  if (!action) return ''
  return CHECKLIST_ACTION_LABELS[action as ChecklistItemAction] ?? String(action)
}

export function validDiagnosticsActionsForLabel(label: string): ChecklistItemAction[] {
  return isDiagnosticsOilPrimaryItemLabel(label) ? ['REPLACE', 'TOP_UP'] : ['REPLACE', 'REPAIR']
}

export function isValidDiagnosticsActionForLabel(
  label: string,
  action: string | null | undefined
): action is ChecklistItemAction {
  if (action !== 'REPLACE' && action !== 'TOP_UP' && action !== 'REPAIR') return false
  return validDiagnosticsActionsForLabel(label).includes(action as ChecklistItemAction)
}

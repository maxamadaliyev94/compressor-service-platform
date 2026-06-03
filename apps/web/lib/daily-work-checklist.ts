import type { Prisma } from '@prisma/client'

export type DailyWorkChecklistRow = {
  itemId: string
  label: string
  checked: boolean
}

export function parseDailyWorkChecklist(raw: unknown): DailyWorkChecklistRow[] {
  if (!Array.isArray(raw)) return []
  const out: DailyWorkChecklistRow[] = []
  for (const row of raw) {
    if (typeof row !== 'object' || row === null) continue
    const label = (row as { label?: unknown }).label
    const checked = (row as { checked?: unknown }).checked
    const itemIdRaw = (row as { itemId?: unknown }).itemId
    if (typeof label !== 'string' || typeof checked !== 'boolean') continue
    const trimmed = label.trim()
    if (!trimmed) continue
    const itemId =
      typeof itemIdRaw === 'string' && itemIdRaw.trim()
        ? itemIdRaw.trim()
        : `label:${trimmed.toLowerCase()}`
    out.push({ itemId, label: trimmed, checked })
  }
  return out
}

export function dailyChecklistToJson(rows: DailyWorkChecklistRow[]): Prisma.InputJsonValue {
  return rows.map((r) => ({
    itemId: r.itemId,
    label: r.label,
    checked: r.checked,
  }))
}

export function buildDailyWorkDescription(
  checklist: DailyWorkChecklistRow[],
  optionalNotes?: string | null
): string {
  const checked = checklist.filter((r) => r.checked).map((r) => r.label)
  const notes = optionalNotes?.trim()
  if (checked.length === 0) return notes || ''
  if (!notes) return checked.join('; ')
  return `${checked.join('; ')}\n\n${notes}`
}

export function collectUniqueCheckedDailyWorkItems(
  dailyWorks: { checklist: unknown }[]
): DailyWorkChecklistRow[] {
  const seen = new Set<string>()
  const result: DailyWorkChecklistRow[] = []
  for (const dw of dailyWorks) {
    for (const row of parseDailyWorkChecklist(dw.checklist)) {
      if (!row.checked) continue
      const key = row.itemId || row.label.trim().toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      result.push(row)
    }
  }
  return result
}

export function mergeChecklistWithSaved(
  catalog: DailyWorkChecklistRow[],
  saved: DailyWorkChecklistRow[]
): DailyWorkChecklistRow[] {
  const savedById = new Map(saved.map((r) => [r.itemId, r]))
  const savedByLabel = new Map(saved.map((r) => [r.label.trim().toLowerCase(), r]))
  return catalog.map((item) => {
    const hit = savedById.get(item.itemId) ?? savedByLabel.get(item.label.trim().toLowerCase())
    return hit ? { ...item, checked: hit.checked } : item
  })
}

export function splitDescriptionAndNotes(description: string): {
  workSummary: string
  optionalNotes: string
} {
  const text = description.trim()
  if (!text) return { workSummary: '', optionalNotes: '' }
  const parts = text.split(/\n\n/)
  if (parts.length >= 2) {
    return { workSummary: parts[0].trim(), optionalNotes: parts.slice(1).join('\n\n').trim() }
  }
  return { workSummary: text, optionalNotes: '' }
}

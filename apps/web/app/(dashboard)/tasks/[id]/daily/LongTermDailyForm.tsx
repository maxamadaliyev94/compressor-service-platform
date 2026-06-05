'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  mergeChecklistWithSaved,
  parseDailyWorkChecklist,
  splitDescriptionAndNotes,
  type DailyWorkChecklistRow,
} from '@/lib/daily-work-checklist'

export default function LongTermDailyForm({
  taskId,
  engineerId,
  workCatalog,
  regulationName,
  initialDate,
}: {
  taskId: string
  engineerId: string
  workCatalog: DailyWorkChecklistRow[]
  regulationName?: string | null
  initialDate: string
}) {
  const router = useRouter()
  const [date, setDate] = useState(initialDate)
  const [optionalNotes, setOptionalNotes] = useState('')
  const [checklist, setChecklist] = useState<DailyWorkChecklistRow[]>(() =>
    workCatalog.map((c) => ({ ...c, checked: false }))
  )
  const [busy, setBusy] = useState(false)
  const [loadingEntry, setLoadingEntry] = useState(false)

  const canSubmit = useMemo(
    () => checklist.some((row) => row.checked),
    [checklist]
  )

  useEffect(() => {
    let cancelled = false
    setLoadingEntry(true)
    fetch(`/api/tasks/${taskId}/daily-work`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        const entries = Array.isArray(data?.entries) ? data.entries : []
        const entry = entries.find(
          (e: { date?: string; engineer?: { id?: string } }) =>
            e.date === date && e.engineer?.id === engineerId
        )
        if (entry) {
          const saved = parseDailyWorkChecklist(entry.checklist)
          setChecklist(mergeChecklistWithSaved(workCatalog, saved))
          const { optionalNotes: notes } = splitDescriptionAndNotes(entry.description || '')
          setOptionalNotes(notes)
        } else {
          setChecklist(workCatalog.map((c) => ({ ...c, checked: false })))
          setOptionalNotes('')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setChecklist(workCatalog.map((c) => ({ ...c, checked: false })))
          setOptionalNotes('')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingEntry(false)
      })
    return () => {
      cancelled = true
    }
  }, [date, taskId, engineerId, workCatalog])

  function toggle(itemId: string) {
    setChecklist((prev) =>
      prev.map((row) => (row.itemId === itemId ? { ...row, checked: !row.checked } : row))
    )
  }

  async function save() {
    if (!canSubmit) {
      alert('Отметьте хотя бы одну выполненную работу из списка')
      return
    }
    setBusy(true)
    const r = await fetch(`/api/tasks/${taskId}/daily-work`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        optionalNotes: optionalNotes.trim(),
        checklist: checklist.map((c) => ({
          itemId: c.itemId,
          label: c.label,
          checked: c.checked,
        })),
      }),
    })
    setBusy(false)
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      alert((d as { error?: string }).error || 'Не удалось сохранить')
      return
    }
    router.refresh()
  }

  return (
    <div className="bg-white border rounded-xl p-5 space-y-4">
      <h2 className="font-semibold text-gray-900">Отчёт за день</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <label>
          <span className="text-gray-500 block mb-1">Дата</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          />
        </label>
      </div>
      <div>
        <div className="text-sm font-medium text-gray-800 mb-1">
          Выполненные работы за день *
        </div>
        <p className="text-xs text-gray-500 mb-2">
          {regulationName
            ? `Чек-лист «${regulationName}» из справочника`
            : 'Список из справочника для данного типа работ и оборудования'}
        </p>
        {loadingEntry ? (
          <div className="text-sm text-gray-400 border rounded-lg px-3 py-4">Загрузка…</div>
        ) : (
          <div className="border rounded-lg divide-y max-h-72 overflow-y-auto">
            {checklist.map((row) => (
              <label
                key={row.itemId}
                className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={row.checked}
                  onChange={() => toggle(row.itemId)}
                  className="w-4 h-4 accent-indigo-600 shrink-0"
                />
                <span>{row.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>
      <label className="block text-sm">
        <span className="text-gray-500 block mb-1">Дополнительные заметки</span>
        <textarea
          value={optionalNotes}
          onChange={(e) => setOptionalNotes(e.target.value)}
          rows={3}
          className="w-full border rounded-lg px-3 py-2"
          placeholder="Необязательно: особые условия, отклонения, комментарии…"
        />
      </label>
      <button
        type="button"
        disabled={busy || !canSubmit || loadingEntry}
        onClick={() => void save()}
        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
      >
        {busy ? 'Сохранение…' : 'Сохранить за выбранный день'}
      </button>
    </div>
  )
}

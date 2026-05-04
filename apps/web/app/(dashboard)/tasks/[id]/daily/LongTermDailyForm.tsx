'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

type CheckRow = { label: string; checked: boolean }

export default function LongTermDailyForm({
  taskId,
  initialChecklist,
  initialDate,
}: {
  taskId: string
  initialChecklist: CheckRow[]
  initialDate: string
}) {
  const router = useRouter()
  const [date, setDate] = useState(initialDate)
  const [description, setDescription] = useState('')
  const [checklist, setChecklist] = useState<CheckRow[]>(() => initialChecklist.map((c) => ({ ...c })))
  const [busy, setBusy] = useState(false)

  const canSubmit = useMemo(() => description.trim().length > 0, [description])

  function toggle(idx: number) {
    setChecklist((prev) => prev.map((row, i) => (i === idx ? { ...row, checked: !row.checked } : row)))
  }

  async function save() {
    if (!canSubmit) {
      alert('Заполните описание работ за день')
      return
    }
    setBusy(true)
    const r = await fetch(`/api/tasks/${taskId}/daily-work`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        description: description.trim(),
        checklist: checklist.map((c) => ({ label: c.label, checked: c.checked })),
      }),
    })
    setBusy(false)
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      alert((d as { error?: string }).error || 'Не удалось сохранить')
      return
    }
    setDescription('')
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
      <label className="block text-sm">
        <span className="text-gray-500 block mb-1">Что сделано за день *</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full border rounded-lg px-3 py-2"
          placeholder="Кратко опишите выполненные работы…"
        />
      </label>
      <div>
        <div className="text-sm font-medium text-gray-800 mb-2">Чек-лист</div>
        <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
          {checklist.map((row, idx) => (
            <label key={`${row.label}-${idx}`} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={row.checked}
                onChange={() => toggle(idx)}
                className="w-4 h-4 accent-indigo-600 shrink-0"
              />
              <span>{row.label}</span>
            </label>
          ))}
        </div>
      </div>
      <button
        type="button"
        disabled={busy || !canSubmit}
        onClick={() => void save()}
        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
      >
        {busy ? 'Сохранение…' : 'Сохранить за выбранный день'}
      </button>
    </div>
  )
}

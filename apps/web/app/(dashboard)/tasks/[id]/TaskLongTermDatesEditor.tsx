'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type Field = 'startDate' | 'endDate'

function toInputValue(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

function Row({
  label,
  field,
  valueIso,
  canEdit,
  saving,
  onSave,
}: {
  label: string
  field: Field
  valueIso: string | null
  canEdit: boolean
  saving: boolean
  onSave: (field: Field, payload: string | null) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const display = valueIso ? new Date(valueIso).toLocaleDateString('ru-RU', { timeZone: 'UTC' }) : '—'

  useEffect(() => {
    if (editing) return
    setDraft(toInputValue(valueIso))
  }, [valueIso, editing])

  async function save() {
    const payload = draft.trim() === '' ? null : draft.trim()
    const ok = await onSave(field, payload)
    if (ok) setEditing(false)
  }

  if (!canEdit) {
    return (
      <div className="flex gap-2 items-baseline flex-wrap">
        <span className="text-gray-500 w-36 shrink-0">{label}</span>
        <span>{display}</span>
      </div>
    )
  }

  if (!editing) {
    return (
      <div className="flex gap-2 items-baseline flex-wrap">
        <span className="text-gray-500 w-36 shrink-0">{label}</span>
        <span className="inline-flex items-center gap-1.5 flex-wrap">
          <span>{display}</span>
          <button
            type="button"
            className="text-base leading-none p-0.5 rounded hover:bg-gray-100"
            title="Изменить"
            aria-label={`Изменить: ${label}`}
            disabled={saving}
            onClick={() => {
              setDraft(toInputValue(valueIso))
              setEditing(true)
            }}
          >
            ✏️
          </button>
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
      <span className="text-gray-500 w-36 shrink-0 text-sm pt-0.5">{label}</span>
      <span className="inline-flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="border border-gray-300 rounded-md px-2 py-1 text-sm"
        />
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
        >
          {saving ? '…' : 'Сохранить'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setEditing(false)
            setDraft(toInputValue(valueIso))
          }}
          className="text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
        >
          Отмена
        </button>
      </span>
    </div>
  )
}

export default function TaskLongTermDatesEditor({
  taskId,
  startDateIso,
  endDateIso,
  canEdit,
}: {
  taskId: string
  startDateIso: string | null
  endDateIso: string | null
  canEdit: boolean
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  async function onSave(field: Field, payload: string | null): Promise<boolean> {
    setSaving(true)
    try {
      const r = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: payload }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        alert((d as { error?: string }).error || 'Не удалось сохранить')
        return false
      }
      router.refresh()
      return true
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <Row label="Дата начала" field="startDate" valueIso={startDateIso} canEdit={canEdit} saving={saving} onSave={onSave} />
      <Row label="Дата окончания" field="endDate" valueIso={endDateIso} canEdit={canEdit} saving={saving} onSave={onSave} />
    </div>
  )
}

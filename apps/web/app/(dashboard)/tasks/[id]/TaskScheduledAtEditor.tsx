'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function TaskScheduledAtEditor({
  taskId,
  scheduledAtIso,
  canEdit,
}: {
  taskId: string
  scheduledAtIso: string | null
  canEdit: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState('')

  const displayStr = scheduledAtIso
    ? new Date(scheduledAtIso).toLocaleDateString('ru-RU')
    : '—'

  useEffect(() => {
    if (editing) return
    setDraft(scheduledAtIso ? scheduledAtIso.slice(0, 10) : '')
  }, [scheduledAtIso, editing])

  async function save() {
    setSaving(true)
    const scheduledAt =
      draft && draft.length > 0 ? new Date(draft).toISOString() : null
    const r = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduledAt }),
    })
    setSaving(false)
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      alert((d as { error?: string }).error || 'Не удалось сохранить')
      return
    }
    setEditing(false)
    router.refresh()
  }

  if (!canEdit) {
    return <span>{displayStr}</span>
  }

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-1.5 flex-wrap">
        <span>{displayStr}</span>
        <button
          type="button"
          className="text-base leading-none p-0.5 rounded hover:bg-gray-100"
          title="Изменить срок"
          aria-label="Изменить срок"
          onClick={() => {
            setDraft(scheduledAtIso ? scheduledAtIso.slice(0, 10) : '')
            setEditing(true)
          }}
        >
          ✏️
        </button>
      </span>
    )
  }

  return (
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
          setDraft(scheduledAtIso ? scheduledAtIso.slice(0, 10) : '')
        }}
        className="text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
      >
        Отмена
      </button>
    </span>
  )
}

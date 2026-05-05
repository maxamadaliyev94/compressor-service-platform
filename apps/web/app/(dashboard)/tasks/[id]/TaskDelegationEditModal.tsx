'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type Child = {
  id: string
  status: string
  assignedToId: string | null
  assignedTo: { id: string; name: string } | null
}

type Engineer = { id: string; name: string }

function useDelegatedChildren(taskId: string, open: boolean) {
  const [children, setChildren] = useState<Child[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch(`/api/tasks/${taskId}/delegated-children`)
    if (!r.ok) return
    const data = (await r.json()) as { children?: Child[] }
    setChildren(Array.isArray(data.children) ? data.children : [])
  }, [taskId])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      await load()
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [open, load])

  return { children, loading, reload: load }
}

function DelegationChildRow({
  child,
  engineers,
  siblingTakenIds,
  busy,
  onCancel,
  onSaveReplace,
}: {
  child: Child
  engineers: Engineer[]
  siblingTakenIds: Set<string>
  busy: boolean
  onCancel: () => void
  onSaveReplace: (engineerId: string) => void
}) {
  const closed = child.status === 'DONE' || child.status === 'CANCELLED'
  const initial = child.assignedToId || ''
  const [choice, setChoice] = useState(initial)

  useEffect(() => {
    setChoice(child.assignedToId || '')
  }, [child.assignedToId, child.id])

  const options = useMemo(() => {
    return engineers.filter((e) => !siblingTakenIds.has(e.id) || e.id === child.assignedToId)
  }, [engineers, siblingTakenIds, child.assignedToId])

  if (closed) {
    return (
      <li className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
        <div className="font-medium text-gray-700">{child.assignedTo?.name || '—'}</div>
        <div className="text-xs text-gray-500 mt-0.5">
          {child.status === 'CANCELLED' ? 'Назначение снято (задача отменена)' : 'Задача закрыта — замена недоступна'}
        </div>
      </li>
    )
  }

  const changed = choice !== initial
  const invalid = !choice

  return (
    <li className="rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm space-y-2">
      <div className="font-medium text-gray-900">{child.assignedTo?.name || 'Не назначен'}</div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="flex flex-col gap-1 text-xs text-gray-600 flex-1 min-w-0">
          <span>Заменить на</span>
          <select
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            disabled={busy}
            className="border rounded-md px-2 py-1.5 text-sm text-gray-900 bg-white disabled:opacity-50"
          >
            <option value="">— выберите —</option>
            {options.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          disabled={busy || !changed || invalid}
          onClick={() => onSaveReplace(choice)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Сохранить
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Снять назначение
        </button>
      </div>
    </li>
  )
}

export default function TaskDelegationEditModal({
  taskId,
  open,
  onClose,
  engineers,
  onSaved,
}: {
  taskId: string
  open: boolean
  onClose: () => void
  engineers: Engineer[]
  onSaved: () => void
}) {
  const { children, loading, reload } = useDelegatedChildren(taskId, open)
  const [savingId, setSavingId] = useState<string | null>(null)

  function siblingTakenIds(exceptChildId: string): Set<string> {
    const s = new Set<string>()
    for (const c of children) {
      if (c.id === exceptChildId) continue
      if (['CANCELLED', 'DONE'].includes(c.status) || !c.assignedToId) continue
      s.add(c.assignedToId)
    }
    return s
  }

  async function cancelAssignment(childId: string) {
    if (!confirm('Снять назначение (отменить задачу для этого инженера)?')) return
    setSavingId(childId)
    const r = await fetch(`/api/tasks/${childId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED' }),
    })
    setSavingId(null)
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      alert((d as { error?: string }).error || 'Не удалось отменить')
      return
    }
    await reload()
    onSaved()
  }

  async function saveReplace(childId: string, assignedToId: string) {
    setSavingId(childId)
    const r = await fetch(`/api/tasks/${childId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedToId }),
    })
    setSavingId(null)
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      alert((d as { error?: string }).error || 'Не удалось сохранить')
      return
    }
    await reload()
    onSaved()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="presentation"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delegation-edit-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 flex justify-between items-center gap-2">
          <h3 id="delegation-edit-title" className="font-semibold text-gray-900">
            Редактировать назначение
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <p className="text-sm text-gray-500">Загрузка…</p>
          ) : children.length === 0 ? (
            <p className="text-sm text-gray-500">Нет распределённых задач</p>
          ) : (
            <ul className="space-y-3">
              {children.map((c) => (
                <DelegationChildRow
                  key={c.id}
                  child={c}
                  engineers={engineers}
                  siblingTakenIds={siblingTakenIds(c.id)}
                  busy={savingId === c.id}
                  onCancel={() => void cancelAssignment(c.id)}
                  onSaveReplace={(id) => void saveReplace(c.id, id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

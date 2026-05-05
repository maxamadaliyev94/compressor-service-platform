'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import TaskDelegationEditModal from './TaskDelegationEditModal'

type UserRow = { id: string; name: string; role: string; isActive?: boolean }

type DelegatedChild = {
  id: string
  status: string
  assignedToId: string | null
  assignedTo: { id: string; name: string } | null
}

export default function TaskDelegatePanel({ taskId }: { taskId: string }) {
  const router = useRouter()
  const [users, setUsers] = useState<UserRow[]>([])
  const [delegated, setDelegated] = useState<DelegatedChild[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingDelegated, setLoadingDelegated] = useState(true)
  const [editOpen, setEditOpen] = useState(false)

  const loadDelegated = useCallback(async () => {
    const r = await fetch(`/api/tasks/${taskId}/delegated-children`)
    if (!r.ok) {
      setDelegated([])
      return
    }
    const data = (await r.json()) as { children?: DelegatedChild[] }
    setDelegated(Array.isArray(data.children) ? data.children : [])
  }, [taskId])

  useEffect(() => {
    let cancelled = false
    fetch('/api/users')
      .then((r) => r.json())
      .then((data: UserRow[]) => {
        if (cancelled) return
        const list = Array.isArray(data) ? data : []
        setUsers(list.filter((u) => u.role === 'ENGINEER' && (u.isActive !== false)))
      })
      .finally(() => {
        if (!cancelled) setLoadingUsers(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingDelegated(true)
      await loadDelegated()
      if (!cancelled) setLoadingDelegated(false)
    })()
    return () => {
      cancelled = true
    }
  }, [loadDelegated])

  useEffect(() => {
    const ids = new Set(
      delegated
        .filter((c) => !['CANCELLED', 'DONE'].includes(c.status) && c.assignedToId)
        .map((c) => c.assignedToId as string)
    )
    setSelected((prev) => prev.filter((id) => !ids.has(id)))
  }, [delegated])

  const alreadyIds = new Set(
    delegated
      .filter((c) => !['CANCELLED', 'DONE'].includes(c.status) && c.assignedToId)
      .map((c) => c.assignedToId as string)
  )

  async function submit() {
    const toAssign = selected.filter((id) => !alreadyIds.has(id))
    if (toAssign.length === 0) {
      alert('Выберите инженеров, которые ещё не назначены на эту заявку')
      return
    }
    if (!confirm(`Создать ${toAssign.length} задач(и) для выбранных инженеров?`)) return
    setLoading(true)
    const res = await fetch(`/api/tasks/${taskId}/delegate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engineerIds: toAssign }),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert((data as { error?: string }).error || 'Не удалось распределить')
      return
    }
    setSelected([])
    await loadDelegated()
    router.refresh()
  }

  function toggle(id: string) {
    if (alreadyIds.has(id)) return
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const engineersForModal = users.map((u) => ({ id: u.id, name: u.name }))
  const hasActiveDelegated = delegated.some((c) => !['CANCELLED', 'DONE'].includes(c.status))

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 mb-6">
      <h2 className="font-semibold text-indigo-900 mb-1">Распределить инженерам</h2>
      <p className="text-sm text-indigo-800 mb-3">
        Выберите одного или нескольких инженеров. Для каждого будет создана отдельная задача, эта заявка будет закрыта
        как «распределённая».
      </p>
      {loadingUsers || loadingDelegated ? (
        <p className="text-sm text-gray-500">Загрузка списка…</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-gray-500">Нет доступных инженеров</p>
      ) : (
        <div className="border rounded-lg bg-white p-3 max-h-48 overflow-y-auto space-y-2 mb-3">
          {users.map((u) => {
            const assigned = alreadyIds.has(u.id)
            return (
              <label
                key={u.id}
                className={`flex items-start gap-2 text-sm ${assigned ? 'cursor-not-allowed text-gray-400' : 'cursor-pointer'}`}
              >
                <input
                  type="checkbox"
                  checked={assigned || selected.includes(u.id)}
                  disabled={assigned}
                  onChange={() => toggle(u.id)}
                  className="w-4 h-4 mt-0.5 accent-indigo-600 shrink-0 disabled:opacity-50"
                />
                <span className="flex flex-col min-w-0">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className={assigned ? '' : 'text-gray-900'}>{u.name}</span>
                    {assigned && (
                      <span className="text-xs text-gray-500 inline-flex items-center gap-1">
                        <span aria-hidden>✓</span>
                        Уже назначен
                      </span>
                    )}
                  </span>
                </span>
              </label>
            )
          })}
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={loading || loadingUsers || loadingDelegated || selected.length === 0}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Отправка…' : `Назначить выбранным (${selected.length})`}
        </button>
        {hasActiveDelegated && (
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="border border-indigo-300 text-indigo-800 px-4 py-2 rounded-lg text-sm hover:bg-indigo-100/80"
          >
            Редактировать назначение
          </button>
        )}
      </div>

      <TaskDelegationEditModal
        taskId={taskId}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        engineers={engineersForModal}
        onSaved={() => {
          void loadDelegated()
          router.refresh()
        }}
      />
    </div>
  )
}

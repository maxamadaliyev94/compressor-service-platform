'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type UserRow = { id: string; name: string; role: string; isActive?: boolean }

export default function TaskDelegatePanel({ taskId }: { taskId: string }) {
  const router = useRouter()
  const [users, setUsers] = useState<UserRow[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(true)

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

  async function submit() {
    if (selected.length === 0) {
      alert('Выберите хотя бы одного инженера')
      return
    }
    if (!confirm(`Создать ${selected.length} задач(и) для выбранных инженеров и закрыть эту заявку?`)) return
    setLoading(true)
    const res = await fetch(`/api/tasks/${taskId}/delegate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engineerIds: selected }),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert((data as { error?: string }).error || 'Не удалось распределить')
      return
    }
    router.push('/tasks')
    router.refresh()
  }

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 mb-6">
      <h2 className="font-semibold text-indigo-900 mb-1">Распределить инженерам</h2>
      <p className="text-sm text-indigo-800 mb-3">
        Выберите одного или нескольких инженеров. Для каждого будет создана отдельная задача, эта заявка будет
        закрыта как «распределённая».
      </p>
      {loadingUsers ? (
        <p className="text-sm text-gray-500">Загрузка списка…</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-gray-500">Нет доступных инженеров</p>
      ) : (
        <div className="border rounded-lg bg-white p-3 max-h-48 overflow-y-auto space-y-2 mb-3">
          {users.map((u) => (
            <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(u.id)}
                onChange={() => toggle(u.id)}
                className="w-4 h-4 accent-indigo-600"
              />
              <span>{u.name}</span>
            </label>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => void submit()}
        disabled={loading || loadingUsers || selected.length === 0}
        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? 'Отправка…' : `Назначить выбранным (${selected.length})`}
      </button>
    </div>
  )
}

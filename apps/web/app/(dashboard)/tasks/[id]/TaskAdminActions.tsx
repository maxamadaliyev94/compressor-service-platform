'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function TaskAdminActions({
  taskId,
  canCancel,
  canDelete,
}: {
  taskId: string
  canCancel: boolean
  canDelete: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function cancelTask() {
    if (!confirm('Отменить задачу?')) return
    setLoading(true)
    const res = await fetch(`/api/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED' }),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Не удалось отменить задачу')
      return
    }
    router.refresh()
  }

  async function deleteTask() {
    if (!confirm('Удалить задачу безвозвратно?')) return
    setLoading(true)
    const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Не удалось удалить задачу')
      return
    }
    router.push('/tasks')
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      {canCancel && (
        <button
          onClick={cancelTask}
          disabled={loading}
          className="border border-orange-200 text-orange-700 px-3 py-2 rounded-lg text-sm hover:bg-orange-50 disabled:opacity-50"
        >
          Отменить
        </button>
      )}
      {canDelete && (
        <button
          onClick={deleteTask}
          disabled={loading}
          className="border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50"
        >
          Удалить
        </button>
      )}
    </div>
  )
}

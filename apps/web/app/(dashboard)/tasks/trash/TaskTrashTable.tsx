'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

type TrashTask = {
  id: string
  type: string
  priority: string
  status: string
  deletedAt: string | Date | null
  equipment: { brand: string; model: string; serialNumber: string }
  assignedTo: { name: string } | null
  deletedBy: { name: string } | null
}

const typeLabels: Record<string, string> = {
  PLANNED_MAINTENANCE: 'Плановое ТО',
  DIAGNOSTICS: 'Диагностика',
  WARRANTY_REPAIR: 'Гарантийный ремонт',
  EMERGENCY: 'Аварийный выезд',
  INSTALLATION: 'Монтаж',
  COMMISSIONING: 'Пусконаладка',
}

export default function TaskTrashTable({ tasks }: { tasks: TrashTask[] }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [deleteLoading, setDeleteLoading] = useState(false)

  const allIds = useMemo(() => tasks.map((t) => t.id), [tasks])
  const selectedCount = selected.size
  const allSelected = tasks.length > 0 && selectedCount === tasks.length

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(allIds))
  }

  async function restoreTask(taskId: string) {
    if (!confirm('Восстановить задачу из корзины?')) return
    setBusyId(taskId)
    const res = await fetch(`/api/tasks/${taskId}/restore`, { method: 'PATCH' })
    setBusyId(null)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Не удалось восстановить задачу')
      return
    }
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(taskId)
      return next
    })
    router.refresh()
  }

  async function deleteSelected() {
    if (selectedCount === 0) return
    if (!confirm('Вы уверены что хотите удалить выбранные задачи?')) return
    setDeleteLoading(true)
    const res = await fetch('/api/tasks/trash/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selected] }),
    })
    setDeleteLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert((data as { error?: string }).error || 'Не удалось удалить задачи')
      return
    }
    setSelected(new Set())
    router.refresh()
  }

  if (tasks.length === 0) {
    return (
      <div className="bg-white border rounded-xl p-10 text-center text-gray-400 text-sm">
        Корзина задач пуста
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
        <button
          type="button"
          onClick={selectAll}
          className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50 w-full sm:w-auto"
        >
          {allSelected ? 'Снять выбор' : 'Выбрать все'}
        </button>
        {selectedCount > 0 && (
          <button
            type="button"
            onClick={() => void deleteSelected()}
            disabled={deleteLoading}
            className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 disabled:opacity-50 w-full sm:w-auto"
          >
            {deleteLoading ? 'Удаление…' : `Удалить выбранные (${selectedCount})`}
          </button>
        )}
      </div>

      <div className="space-y-3">
        {tasks.map((task) => {
          const isChecked = selected.has(task.id)
          return (
            <div key={task.id} className="bg-white border rounded-xl p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <label className="flex items-center shrink-0 cursor-pointer pt-0.5">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleOne(task.id)}
                      aria-label="Выбрать задачу"
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </label>
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{typeLabels[task.type] || task.type}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      {task.equipment.brand} {task.equipment.model} · {task.equipment.serialNumber}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Удалил: {task.deletedBy?.name || 'Администратор'} ·{' '}
                      {task.deletedAt ? new Date(task.deletedAt).toLocaleString('ru-RU') : '—'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => restoreTask(task.id)}
                  disabled={busyId === task.id}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 shrink-0"
                >
                  Восстановить
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

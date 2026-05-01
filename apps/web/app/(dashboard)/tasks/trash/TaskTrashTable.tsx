'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

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
    <div className="space-y-3">
      {tasks.map((task) => (
        <div key={task.id} className="bg-white border rounded-xl p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="font-medium text-sm">{typeLabels[task.type] || task.type}</div>
              <div className="text-xs text-gray-600 mt-1">
                {task.equipment.brand} {task.equipment.model} · {task.equipment.serialNumber}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Удалил: {task.deletedBy?.name || 'Администратор'} ·{' '}
                {task.deletedAt ? new Date(task.deletedAt).toLocaleString('ru-RU') : '—'}
              </div>
            </div>
            <button
              onClick={() => restoreTask(task.id)}
              disabled={busyId === task.id}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
            >
              Восстановить
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

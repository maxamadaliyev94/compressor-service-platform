'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { formatTaskScheduleRangeRu } from '@/lib/task-schedule-display'

export type MaintenanceHistoryTask = {
  id: string
  type: string
  priority: string
  status: string
  completedAt: string | null
  scheduledAt: string | null
  startDate: string | null
  endDate: string | null
  taskType: string
  comment: string | null
  assignedTo: { name: string } | null
  report: {
    currentHours: number
    nextServiceHours: number | null
    partsUsed: { name: string; quantity: number; unit: string }[]
    notes: string | null
    recommendations: string | null
    actNumber: string | null
  } | null
}

const typeRu: Record<string, string> = {
  PLANNED_MAINTENANCE: 'Плановое ТО',
  DIAGNOSTICS: 'Диагностика',
  WARRANTY_REPAIR: 'Гарантийный ремонт',
  EMERGENCY: 'Аварийный выезд',
  INSTALLATION: 'Монтаж',
  COMMISSIONING: 'Пусконаладка',
}

const priorityColors: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-600',
  HIGH: 'bg-orange-100 text-orange-600',
  EMERGENCY: 'bg-red-100 text-red-600',
}

const priorityLabels: Record<string, string> = {
  LOW: 'Низкий',
  MEDIUM: 'Средний',
  HIGH: 'Высокий',
  EMERGENCY: 'Аварийный',
}

const taskStatusLabels: Record<string, string> = {
  NEW: 'Новая',
  ASSIGNED: 'Назначена',
  IN_PROGRESS: 'В работе',
  DONE: 'Выполнено',
  CANCELLED: 'Отменена',
  REVIEW: 'На проверке',
  DRAFT: 'Черновик',
  REVISION: 'Доработка',
}

const taskStatusColors: Record<string, string> = {
  NEW: 'bg-gray-100 text-gray-700',
  ASSIGNED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  DONE: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
  REVIEW: 'bg-purple-100 text-purple-700',
  DRAFT: 'bg-gray-100 text-gray-500',
  REVISION: 'bg-orange-100 text-orange-700',
}

function scheduleLabel(task: MaintenanceHistoryTask): string {
  return formatTaskScheduleRangeRu({
    taskType: task.taskType,
    status: task.status,
    scheduledAt: task.scheduledAt ? new Date(task.scheduledAt) : null,
    startDate: task.startDate ? new Date(task.startDate) : null,
    endDate: task.endDate ? new Date(task.endDate) : null,
  })
}

export default function EquipmentMaintenanceHistory({
  tasks,
  canBulkDelete,
}: {
  tasks: MaintenanceHistoryTask[]
  canBulkDelete: boolean
}) {
  const router = useRouter()
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

  async function deleteSelected() {
    if (selectedCount === 0) return
    if (!confirm('Вы уверены что хотите удалить выбранные задачи?')) return
    setDeleteLoading(true)
    const ids = [...selected]
    const results = await Promise.allSettled(
      ids.map((id) => fetch(`/api/tasks/${id}`, { method: 'DELETE' })),
    )
    setDeleteLoading(false)

    const failed: string[] = []
    results.forEach((r, i) => {
      if (r.status === 'rejected' || !r.value.ok) {
        failed.push(ids[i])
      }
    })

    if (failed.length > 0) {
      const msg =
        failed.length === ids.length
          ? 'Не удалось удалить выбранные задачи (возможно, есть отчёт или нет прав).'
          : `Не удалось удалить часть задач (${failed.length} из ${ids.length}). Возможно, у задачи уже есть отчёт.`
      alert(msg)
    }

    setSelected(new Set())
    router.refresh()
  }

  if (tasks.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400 text-sm">
        <div className="text-3xl mb-2">📋</div>
        История работ пока пуста
      </div>
    )
  }

  return (
    <>
      {canBulkDelete && (
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 p-3 border-b bg-gray-50/80">
          <button
            type="button"
            onClick={selectAll}
            className="border px-4 py-2 rounded-lg text-sm hover:bg-white bg-white w-full sm:w-auto"
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
      )}

      <div className="divide-y">
        {tasks.map((task) => {
          const isDone = task.status === 'DONE'
          const isChecked = selected.has(task.id)

          return (
            <div key={task.id} className="p-4 hover:bg-gray-50 transition-colors group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3 flex-1 min-w-0">
                  {canBulkDelete && (
                    <label className="flex items-start shrink-0 pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOne(task.id)}
                        aria-label="Выбрать задачу"
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </label>
                  )}

                  <Link
                    href={`/tasks/${task.id}`}
                    className="flex gap-3 flex-1 min-w-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                        isDone
                          ? 'bg-green-100 text-green-700'
                          : task.status === 'CANCELLED'
                            ? 'bg-red-100 text-red-700'
                            : task.status === 'IN_PROGRESS'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {isDone ? '✓' : task.status === 'CANCELLED' ? '✕' : task.status === 'IN_PROGRESS' ? '▶' : '○'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-sm text-gray-900">
                          {typeRu[task.type] || task.type}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[task.priority] || ''}`}
                        >
                          {priorityLabels[task.priority] || task.priority}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${taskStatusColors[task.status] || ''}`}
                        >
                          {taskStatusLabels[task.status] || task.status}
                        </span>
                      </div>

                      {task.assignedTo && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                            {task.assignedTo.name.charAt(0)}
                          </div>
                          <span className="text-xs text-gray-600">{task.assignedTo.name}</span>
                        </div>
                      )}

                      {task.report && (
                        <div className="mt-2 bg-green-50 border border-green-100 rounded-lg p-2.5 grid grid-cols-2 gap-x-4 gap-y-1">
                          <div className="text-xs text-gray-500">
                            Моточасы:{' '}
                            <span className="font-semibold text-gray-800">{task.report.currentHours} м/ч</span>
                          </div>
                          {task.report.nextServiceHours != null && (
                            <div className="text-xs text-gray-500">
                              След. ТО:{' '}
                              <span className="font-semibold text-gray-800">{task.report.nextServiceHours} м/ч</span>
                            </div>
                          )}
                          {task.report.partsUsed?.length > 0 && (
                            <div className="text-xs text-gray-500 col-span-2">
                              Запчасти:{' '}
                              <span className="font-medium text-gray-700">
                                {task.report.partsUsed.map((p) => `${p.name} (${p.quantity} ${p.unit})`).join(', ')}
                              </span>
                            </div>
                          )}
                          {task.report.notes && (
                            <div className="text-xs text-gray-500 col-span-2 italic">
                              &ldquo;{task.report.notes}&rdquo;
                            </div>
                          )}
                          {task.report.recommendations && (
                            <div className="text-xs col-span-2 bg-yellow-50 border border-yellow-100 rounded px-2 py-1 text-yellow-800">
                              💡 {task.report.recommendations}
                            </div>
                          )}
                          {task.report.actNumber && (
                            <div className="text-xs text-gray-400 col-span-2">Акт № {task.report.actNumber}</div>
                          )}
                        </div>
                      )}

                      {task.comment && !task.report && (
                        <div className="text-xs text-gray-500 italic mt-1">
                          &ldquo;{task.comment}&rdquo;
                        </div>
                      )}
                    </div>
                  </Link>
                </div>

                <div className="text-right flex-shrink-0 space-y-1">
                  <div className="text-xs text-gray-400">
                    {task.completedAt
                      ? new Date(task.completedAt).toLocaleDateString('ru-RU')
                      : scheduleLabel(task) !== '—'
                        ? scheduleLabel(task)
                        : '—'}
                  </div>
                  {task.report && (
                    <a
                      href={`/api/tasks/${task.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-xs text-blue-600 hover:underline border border-blue-200 px-2 py-0.5 rounded hover:bg-blue-50"
                    >
                      📄 Акт
                    </a>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const COLUMNS = [
  { id: 'NEW', label: 'Новые', color: 'bg-gray-100 border-gray-300' },
  { id: 'ASSIGNED', label: 'Назначены', color: 'bg-blue-50 border-blue-200' },
  { id: 'IN_PROGRESS', label: 'В работе', color: 'bg-yellow-50 border-yellow-200' },
  { id: 'REVIEW', label: 'На проверке', color: 'bg-purple-50 border-purple-200' },
  { id: 'DONE', label: 'Выполнено', color: 'bg-green-50 border-green-200' },
]

const priorityColors: Record<string, string> = {
  LOW: 'bg-gray-200', MEDIUM: 'bg-blue-400',
  HIGH: 'bg-orange-400', EMERGENCY: 'bg-red-500',
}

const typeLabels: Record<string, string> = {
  PLANNED_MAINTENANCE: 'Плановое ТО', DIAGNOSTICS: 'Диагностика',
  WARRANTY_REPAIR: 'Гарантийный ремонт', EMERGENCY: 'Аварийный выезд',
  INSTALLATION: 'Монтаж', COMMISSIONING: 'Пусконаладка',
}

export default function KanbanBoard({ tasks }: { tasks: any[] }) {
  const router = useRouter()
  const [localTasks, setLocalTasks] = useState(tasks)
  const [dragging, setDragging] = useState<string | null>(null)

  async function moveTask(taskId: string, newStatus: string) {
    setLocalTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    await fetch(`/api/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    })
  }

  function onDragStart(taskId: string) { setDragging(taskId) }
  function onDragOver(e: React.DragEvent) { e.preventDefault() }
  function onDrop(e: React.DragEvent, status: string) {
    e.preventDefault()
    if (dragging) { moveTask(dragging, status); setDragging(null) }
  }

  return (
    <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4">
      {COLUMNS.map(col => {
        const colTasks = localTasks.filter(t => t.status === col.id)
        return (
          <div key={col.id}
            className={`flex-shrink-0 w-[85vw] sm:w-72 md:w-64 rounded-xl border-2 ${col.color} p-3`}
            onDragOver={onDragOver}
            onDrop={e => onDrop(e, col.id)}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-sm text-gray-700">{col.label}</h3>
              <span className="bg-white text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full border">
                {colTasks.length}
              </span>
            </div>
            <div className="space-y-2 min-h-20">
              {colTasks.map(task => (
                <div key={task.id}
                  draggable
                  onDragStart={() => onDragStart(task.id)}
                  onClick={() => router.push(`/tasks/${task.id}`)}
                  className="bg-white rounded-lg p-3 border border-gray-200 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${priorityColors[task.priority]}`}/>
                    <span className="text-xs text-gray-500 truncate">{typeLabels[task.type] || task.type}</span>
                    {task.taskType === 'LONG_TERM' && (
                      <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-1 rounded border border-amber-200" title="Долгосрочная">
                        📅
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-gray-800 mb-1">
                    {task.equipment?.brand} {task.equipment?.model}
                  </div>
                  <div className="text-xs text-gray-500 truncate mb-2">
                    {task.equipment?.object?.branch?.client?.name}
                  </div>
                  {task.assignedTo && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                        {task.assignedTo.name.charAt(0)}
                      </div>
                      <span className="text-xs text-gray-500 truncate">{task.assignedTo.name}</span>
                    </div>
                  )}
                  {task.scheduledAt && (
                    <div className="text-xs text-gray-400 mt-1">
                      📅 {new Date(task.scheduledAt).toLocaleDateString('ru-RU')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

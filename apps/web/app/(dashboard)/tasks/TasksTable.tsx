'use client'
import { Fragment, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type TaskRow = {
  id: string
  requestNumber: number
  type: string
  priority: string
  status: string
  scheduledAt: Date | null
  assignedToId: string | null
  equipment: {
    brand: string
    model: string
    serialNumber: string
    object: {
      name: string
      branch: {
        address: string | null
        latitude: number | null
        longitude: number | null
        client: { name: string; city: string | null }
      }
    }
  }
  assignedTo: { id: string; name: string } | null
  report?: { id: string; clientSignature: string | null } | null
  comment?: string | null
}

type TaskBundle = {
  key: string
  sourceTaskId: string | null
  tasks: TaskRow[]
}

const STATUS_ORDER = ['ASSIGNED', 'NEW', 'IN_PROGRESS', 'REVIEW', 'DRAFT', 'REVISION', 'DONE', 'CANCELLED'] as const

function getSourceTaskId(task: TaskRow): string | null {
  const comment = task.comment || ''
  const match = comment.match(/\[Распределено ГИ из задачи ([^\]]+)\]/)
  return match ? match[1] : null
}

function toBundles(list: TaskRow[]): TaskBundle[] {
  const map = new Map<string, TaskBundle>()
  const sourceIds = new Set(
    list
      .map((task) => getSourceTaskId(task))
      .filter((id): id is string => Boolean(id))
  )

  for (const task of list) {
    const sourceTaskId = getSourceTaskId(task) ?? (sourceIds.has(task.id) ? task.id : null)
    const key = sourceTaskId ? `source:${sourceTaskId}` : `task:${task.id}`
    if (!map.has(key)) {
      map.set(key, { key, sourceTaskId, tasks: [] })
    }
    map.get(key)!.tasks.push(task)
  }
  return [...map.values()]
}

export default function TasksTable({
  tasks,
  typeLabels,
  statusColors,
  statusLabels,
  priorityColors,
  isAdmin,
  currentUserId,
  role,
}: {
  tasks: TaskRow[]
  typeLabels: Record<string, string>
  statusColors: Record<string, string>
  statusLabels: Record<string, string>
  priorityColors: Record<string, string>
  isAdmin: boolean
  currentUserId: string
  role: string
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [groupBy, setGroupBy] = useState<'status' | 'assignee'>(() => (role === 'ENGINEER' ? 'status' : 'assignee'))

  const canGroupByAssignee = role !== 'ENGINEER'

  const statusGroups = useMemo(() => {
    const groups = [
      ...STATUS_ORDER.map((status) => ({
        key: status,
        label: statusLabels[status] || status,
        tasks: tasks.filter((t) => t.status === status),
      })).filter((g) => g.tasks.length > 0),
    ]
    const otherStatusTasks = tasks.filter((t) => !STATUS_ORDER.includes(t.status as (typeof STATUS_ORDER)[number]))
    if (otherStatusTasks.length > 0) {
      groups.push({ key: 'OTHER', label: 'Другое', tasks: otherStatusTasks })
    }
    return groups
  }, [tasks, statusLabels])

  const assigneeGroups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; tasks: TaskRow[] }>()
    for (const task of tasks) {
      const id = task.assignedToId || '_none'
      const label =
        task.assignedToId === currentUserId
          ? 'На мне (распределить / выполнить)'
          : task.assignedTo
            ? task.assignedTo.name
            : 'Без исполнителя'
      if (!map.has(id)) map.set(id, { key: id, label, tasks: [] })
      map.get(id)!.tasks.push(task)
    }
    const list = [...map.values()]
    list.sort((a, b) => {
      if (a.key === currentUserId) return -1
      if (b.key === currentUserId) return 1
      if (a.key === '_none') return 1
      if (b.key === '_none') return -1
      return a.label.localeCompare(b.label, 'ru')
    })
    return list
  }, [tasks, currentUserId])

  const tableColSpan = isAdmin ? 8 : 7
  const sections = !canGroupByAssignee || groupBy === 'status' ? statusGroups : assigneeGroups

  function isResponsibleTask(task: TaskRow, sourceTaskId: string | null) {
    return sourceTaskId !== null && task.id === sourceTaskId
  }

  function getRenderedStatusLabel(task: TaskRow, sourceTaskId: string | null) {
    if (isResponsibleTask(task, sourceTaskId)) return 'Ответственный'
    return statusLabels[task.status] || task.status
  }

  function getRenderedStatusColor(task: TaskRow, sourceTaskId: string | null) {
    if (isResponsibleTask(task, sourceTaskId)) return 'bg-indigo-100 text-indigo-700'
    return statusColors[task.status]
  }

  function getYandexRouteUrl(task: TaskRow) {
    const branch = task.equipment.object.branch
    if (branch.latitude !== null && branch.longitude !== null) {
      return `https://yandex.ru/maps/?mode=routes&rtext=~${branch.latitude},${branch.longitude}&rtt=auto`
    }
    const destinationText = [branch.client.city, branch.address, task.equipment.object.name, branch.client.name]
      .filter(Boolean)
      .join(', ')
    return `https://yandex.ru/maps/?text=${encodeURIComponent(destinationText)}`
  }

  async function cancelTask(taskId: string) {
    if (!confirm('Отменить задачу?')) return
    setBusyId(taskId)
    const res = await fetch(`/api/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED' }),
    })
    setBusyId(null)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert((data as { error?: string }).error || 'Не удалось отменить задачу')
      return
    }
    router.refresh()
  }

  async function deleteTask(taskId: string) {
    if (!confirm('Удалить задачу безвозвратно?')) return
    setBusyId(taskId)
    const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
    setBusyId(null)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert((data as { error?: string }).error || 'Не удалось удалить задачу')
      return
    }
    router.refresh()
  }

  function renderMobileCard(task: TaskRow, sourceTaskId: string | null) {
    return (
      <div key={task.id} className="border rounded-lg p-3 bg-white">
        <a href={`/tasks/${task.id}`} className="block">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium text-sm">
              <span className={`mr-1 ${priorityColors[task.priority]}`}>●</span>
              №{task.requestNumber} · {typeLabels[task.type] || task.type}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRenderedStatusColor(task, sourceTaskId)}`}>
                {getRenderedStatusLabel(task, sourceTaskId)}
              </span>
              {task.status === 'DONE' && task.report && !task.report.clientSignature && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-200 text-right">
                  Нет подписи клиента
                </span>
              )}
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-700">
            {task.equipment.brand} {task.equipment.model}
          </div>
          <div className="text-xs text-gray-500">{task.equipment.serialNumber}</div>
          <div className="mt-2 text-xs text-gray-600">Клиент: {task.equipment.object.branch.client.name}</div>
          <div className="text-xs text-gray-600">Инженер: {task.assignedTo?.name || 'Не назначен'}</div>
          <div className="text-xs text-gray-600">
            Срок: {task.scheduledAt ? new Date(task.scheduledAt).toLocaleDateString('ru-RU') : '—'}
          </div>
        </a>
        <div className="mt-3">
          <a
            href={getYandexRouteUrl(task)}
            target="_blank"
            rel="noreferrer"
            className="w-full min-h-11 inline-flex items-center justify-center gap-1 border border-amber-200 text-amber-700 px-2.5 py-1 rounded text-xs hover:bg-amber-50"
          >
            📍 Маршрут в Яндекс
          </a>
        </div>
        {isAdmin && (
          <div className="mt-3 flex flex-col gap-2">
            {!['DONE', 'CANCELLED'].includes(task.status) && (
              <button
                type="button"
                onClick={() => cancelTask(task.id)}
                disabled={busyId === task.id}
                className="w-full min-h-11 border border-orange-200 text-orange-700 px-2.5 py-1 rounded text-xs hover:bg-orange-50 disabled:opacity-50"
              >
                Отменить
              </button>
            )}
            {!task.report && (
              <button
                type="button"
                onClick={() => deleteTask(task.id)}
                disabled={busyId === task.id}
                className="w-full min-h-11 border border-red-200 text-red-700 px-2.5 py-1 rounded text-xs hover:bg-red-50 disabled:opacity-50"
              >
                Удалить
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  function renderDesktopRow(task: TaskRow, sourceTaskId: string | null, bundled = false, first = false, last = false) {
    const frame = bundled
      ? `${first ? 'border-t border-indigo-200' : ''} ${last ? 'border-b border-indigo-200' : ''} border-x border-indigo-200 bg-indigo-50/20`
      : ''

    return (
      <tr
        key={task.id}
        className={`border-b last:border-0 hover:bg-gray-50 cursor-pointer ${frame}`}
        onClick={() => (window.location.href = `/tasks/${task.id}`)}
      >
        <td className="p-3">
          <span className={`font-medium ${priorityColors[task.priority]}`}>●</span>{' '}
          №{task.requestNumber} · {typeLabels[task.type] || task.type}
        </td>
        <td className="p-3">
          <div>
            {task.equipment.brand} {task.equipment.model}
          </div>
          <div className="text-xs text-gray-500">{task.equipment.serialNumber}</div>
        </td>
        <td className="p-3 text-gray-600">{task.equipment.object.branch.client.name}</td>
        <td className="p-3 text-gray-600">
          {task.assignedTo?.name || <span className="text-gray-400">Не назначен</span>}
        </td>
        <td className="p-3 text-gray-600">
          {task.scheduledAt ? new Date(task.scheduledAt).toLocaleDateString('ru-RU') : '—'}
        </td>
        <td className="p-3">
          <div className="flex flex-col gap-1 items-start">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRenderedStatusColor(task, sourceTaskId)}`}>
              {getRenderedStatusLabel(task, sourceTaskId)}
            </span>
            {task.status === 'DONE' && task.report && !task.report.clientSignature && (
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-200 max-w-[11rem] leading-tight">
                Нет подписи клиента
              </span>
            )}
          </div>
        </td>
        <td className="p-3">
          <a
            href={getYandexRouteUrl(task)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 border border-amber-200 text-amber-700 px-2 py-1 rounded text-xs hover:bg-amber-50"
          >
            📍 Маршрут
          </a>
        </td>
        {isAdmin && (
          <td className="p-3">
            <div className="flex items-center gap-2">
              {!['DONE', 'CANCELLED'].includes(task.status) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    void cancelTask(task.id)
                  }}
                  disabled={busyId === task.id}
                  className="border border-orange-200 text-orange-700 px-2 py-1 rounded text-xs hover:bg-orange-50 disabled:opacity-50"
                >
                  Отменить
                </button>
              )}
              {!task.report && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    void deleteTask(task.id)
                  }}
                  disabled={busyId === task.id}
                  className="border border-red-200 text-red-700 px-2 py-1 rounded text-xs hover:bg-red-50 disabled:opacity-50"
                >
                  Удалить
                </button>
              )}
            </div>
          </td>
        )}
      </tr>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2 md:px-4 border-b bg-slate-50/80">
        <span className="text-xs font-medium text-slate-600">Группировка</span>
        {canGroupByAssignee ? (
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as 'status' | 'assignee')}
            className="text-sm border rounded-lg px-2 py-1.5 bg-white max-w-xs"
          >
            <option value="assignee">По заявке (блоки)</option>
            <option value="status">По статусу</option>
          </select>
        ) : (
          <span className="text-xs text-slate-500">По статусу</span>
        )}
        <span className="text-xs text-slate-400 sm:ml-auto">Всего: {tasks.length}</span>
      </div>

      {tasks.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-400">Нет задач</div>
      ) : (
        <>
          <div className="md:hidden divide-y divide-gray-100 bg-white">
            {sections.map((section) => (
              <div key={section.key}>
                <div className="sticky top-0 z-10 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 border-b border-slate-200">
                  {section.label}
                  <span className="text-slate-400 font-normal"> · {section.tasks.length}</span>
                </div>
                <div className="space-y-3 p-3">
                  {toBundles(section.tasks).map((bundle) => (
                    <div key={bundle.key} className={bundle.tasks.length > 1 ? 'border-2 border-indigo-200 rounded-xl p-2 bg-indigo-50/30' : ''}>
                      {bundle.tasks.length > 1 && (
                        <div className="px-2 py-1 text-xs font-semibold text-indigo-700">
                          Распределенная заявка №{bundle.tasks[0].requestNumber} · инженеров: {bundle.tasks.length}
                        </div>
                      )}
                      <div className="space-y-3">{bundle.tasks.map((task) => renderMobileCard(task, bundle.sourceTaskId))}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <table className="hidden md:table w-full min-w-[900px] text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3 font-medium">Тип</th>
                <th className="text-left p-3 font-medium">Оборудование</th>
                <th className="text-left p-3 font-medium">Клиент</th>
                <th className="text-left p-3 font-medium">Инженер</th>
                <th className="text-left p-3 font-medium">Срок</th>
                <th className="text-left p-3 font-medium">Статус</th>
                <th className="text-left p-3 font-medium">Локация</th>
                {isAdmin && <th className="text-left p-3 font-medium">Действия</th>}
              </tr>
            </thead>
            {sections.map((section) => (
              <tbody key={section.key}>
                <tr className="bg-slate-100 border-y border-slate-200">
                  <td colSpan={tableColSpan} className="p-2.5 text-xs font-semibold text-slate-700">
                    {section.label}
                    <span className="text-slate-400 font-normal"> · {section.tasks.length}</span>
                  </td>
                </tr>
                {toBundles(section.tasks).map((bundle) => (
                  <Fragment key={bundle.key}>
                    {bundle.tasks.length > 1 && (
                      <tr key={`${bundle.key}-header`} className="bg-indigo-50 border-x border-t border-indigo-200">
                        <td colSpan={tableColSpan} className="px-3 py-2 text-xs font-semibold text-indigo-700 border-b border-indigo-100">
                          Распределенная заявка №{bundle.tasks[0].requestNumber} · инженеров: {bundle.tasks.length}
                        </td>
                      </tr>
                    )}
                    {bundle.tasks.map((task, idx) =>
                      renderDesktopRow(task, bundle.sourceTaskId, bundle.tasks.length > 1, idx === 0, idx === bundle.tasks.length - 1)
                    )}
                  </Fragment>
                ))}
              </tbody>
            ))}
          </table>
        </>
      )}
    </div>
  )
}

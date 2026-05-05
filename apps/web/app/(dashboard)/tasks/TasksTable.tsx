'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import ExportTasksButton from './ExportTasksButton'
import {
  formatTaskScheduleRangeRu,
  isTaskEndDateOverdue,
  taskCalendarAnchorDate,
} from '@/lib/task-schedule-display'

type TaskRow = {
  id: string
  requestNumber: number
  type: string
  taskType?: string
  priority: string
  status: string
  createdAt: Date | string
  scheduledAt: Date | null
  startDate?: Date | null
  endDate?: Date | null
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

/** Календарные дни между датой создания задачи и сегодня (локальный календарь). */
function calendarDaysSinceTaskCreated(createdAt: Date | string | undefined | null): number | null {
  if (createdAt == null) return null
  const c = typeof createdAt === 'string' ? new Date(createdAt) : createdAt
  if (Number.isNaN(c.getTime())) return null
  const createdDay = new Date(c.getFullYear(), c.getMonth(), c.getDate())
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((today.getTime() - createdDay.getTime()) / 86400000)
}

/** Левая граница по возрасту задачи (только ASSIGNED / IN_PROGRESS). */
function taskAgeBorderClass(status: string, createdAt: Date | string | undefined | null): string {
  if (!['ASSIGNED', 'IN_PROGRESS'].includes(status)) return ''
  const days = calendarDaysSinceTaskCreated(createdAt)
  if (days === null) return ''
  if (days <= 0) return 'border-l-4 border-green-500'
  if (days === 1) return 'border-l-4 border-amber-400'
  return 'border-l-4 border-red-500'
}

const MONTHS_RU = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
] as const

function matchesScheduleFilter(
  task: TaskRow,
  year: number | 'all',
  month: number | 'all',
  day: number | 'all'
): boolean {
  if (year === 'all' && month === 'all' && day === 'all') return true
  const anchor = taskCalendarAnchorDate(task)
  if (!anchor) return false
  const d = new Date(anchor)
  if (year !== 'all' && d.getFullYear() !== year) return false
  if (month !== 'all' && d.getMonth() + 1 !== month) return false
  if (day !== 'all' && d.getDate() !== day) return false
  return true
}

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
  return [...map.values()].map((b) =>
    b.key.startsWith('source:') ? { ...b, sourceTaskId: b.key.slice('source:'.length) } : b
  )
}

/** Задача-«лидер» распределения (родительская заявка). */
function getRepresentativeTask(bundle: TaskBundle): TaskRow {
  if (bundle.sourceTaskId) {
    const t = bundle.tasks.find((x) => x.id === bundle.sourceTaskId)
    if (t) return t
  }
  return bundle.tasks[0]
}

/** Ответственный первый, остальные по ФИО. */
function sortBundleTasksForDisplay(bundle: TaskBundle): TaskRow[] {
  const rep = getRepresentativeTask(bundle)
  const others = bundle.tasks
    .filter((t) => t.id !== rep.id)
    .sort((a, b) => (a.assignedTo?.name || '').localeCompare(b.assignedTo?.name || '', 'ru'))
  return [rep, ...others]
}

function bundleAssigneeSectionKey(bundle: TaskBundle): string {
  return getRepresentativeTask(bundle).assignedToId || '_none'
}

function bundleAssigneeSectionLabel(bundle: TaskBundle, currentUserId: string): string {
  const rep = getRepresentativeTask(bundle)
  const id = rep.assignedToId || '_none'
  if (id === currentUserId) return 'На мне (распределить / выполнить)'
  if (id === '_none') return 'Без исполнителя'
  return rep.assignedTo?.name || 'Не назначен'
}

function bundleStatusKey(bundle: TaskBundle): string {
  return getRepresentativeTask(bundle).status
}

function bundleToExportTask(bundle: TaskBundle): TaskRow {
  const rep = getRepresentativeTask(bundle)
  const sorted = sortBundleTasksForDisplay(bundle)
  const names = sorted
    .map((t) => t.assignedTo?.name)
    .filter(Boolean)
    .join(', ')
  const firstId = sorted.find((t) => t.assignedTo)?.assignedTo?.id ?? rep.assignedTo?.id ?? rep.id
  return {
    ...rep,
    assignedTo: names ? { id: firstId, name: names } : rep.assignedTo,
  }
}

function BundleEngineerCountBadge({ bundle }: { bundle: TaskBundle }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (!mobileOpen) return
    let cancelled = false
    let onDoc: ((ev: MouseEvent) => void) | undefined
    const t = window.setTimeout(() => {
      if (cancelled) return
      onDoc = () => setMobileOpen(false)
      document.addEventListener('click', onDoc)
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(t)
      if (onDoc) document.removeEventListener('click', onDoc)
    }
  }, [mobileOpen])

  const names = sortBundleTasksForDisplay(bundle)
    .map((t) => t.assignedTo?.name)
    .filter((n): n is string => Boolean(n))

  const list = (
    <ul className="max-h-48 overflow-y-auto space-y-1 py-0.5">
      {names.length === 0 ? (
        <li className="text-gray-400">Нет имён</li>
      ) : (
        names.map((n, i) => (
          <li key={`${bundle.key}-n-${i}`} className="leading-snug break-words">
            {n}
          </li>
        ))
      )}
    </ul>
  )

  return (
    <span
      className="relative inline-flex group/pill align-baseline ml-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="text-[10px] font-medium text-indigo-700 border-b border-dotted border-indigo-400 cursor-pointer md:cursor-help text-left p-0 m-0 bg-transparent font-inherit"
        onClick={(e) => {
          e.stopPropagation()
          if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
            setMobileOpen((o) => !o)
          }
        }}
      >
        · {bundle.tasks.length} инж.
      </button>
      <div className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden min-w-[11rem] max-w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 shadow-lg md:block md:opacity-0 md:invisible md:shadow-xl md:transition-opacity md:duration-150 md:group-hover/pill:pointer-events-auto md:group-hover/pill:visible md:group-hover/pill:opacity-100">
        {list}
      </div>
      {mobileOpen && (
        <div
          className="pointer-events-auto absolute left-0 top-full z-50 mt-1 block min-w-[11rem] max-w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 shadow-xl md:hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {list}
        </div>
      )}
    </span>
  )
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
  const [filterYear, setFilterYear] = useState<number | 'all'>('all')
  const [filterMonth, setFilterMonth] = useState<number | 'all'>('all')
  const [filterDay, setFilterDay] = useState<number | 'all'>('all')

  const canGroupByAssignee = role !== 'ENGINEER'

  const yearOptions = useMemo(() => {
    const years = new Set<number>()
    years.add(new Date().getFullYear())
    for (const t of tasks) {
      if (t.scheduledAt) years.add(new Date(t.scheduledAt).getFullYear())
      if (t.startDate) years.add(new Date(t.startDate).getFullYear())
      if (t.endDate) years.add(new Date(t.endDate).getFullYear())
    }
    return [...years].sort((a, b) => b - a)
  }, [tasks])

  const dayOptions = useMemo(() => {
    if (filterYear !== 'all' && filterMonth !== 'all') {
      const n = new Date(filterYear, filterMonth, 0).getDate()
      return Array.from({ length: n }, (_, i) => i + 1)
    }
    return Array.from({ length: 31 }, (_, i) => i + 1)
  }, [filterYear, filterMonth])

  useEffect(() => {
    if (filterDay === 'all') return
    if (!dayOptions.includes(filterDay)) setFilterDay('all')
  }, [filterDay, dayOptions])

  const allBundles = useMemo(() => toBundles(tasks), [tasks])

  const filteredBundles = useMemo(
    () =>
      allBundles.filter((b) =>
        b.tasks.some((t) => matchesScheduleFilter(t, filterYear, filterMonth, filterDay))
      ),
    [allBundles, filterYear, filterMonth, filterDay]
  )

  type Section = { key: string; label: string; bundles: TaskBundle[] }

  const statusGroups = useMemo((): Section[] => {
    const groups: Section[] = [
      ...STATUS_ORDER.map((status) => ({
        key: status,
        label: statusLabels[status] || status,
        bundles: filteredBundles.filter((b) => bundleStatusKey(b) === status),
      })).filter((g) => g.bundles.length > 0),
    ]
    const otherBundles = filteredBundles.filter(
      (b) => !STATUS_ORDER.includes(bundleStatusKey(b) as (typeof STATUS_ORDER)[number])
    )
    if (otherBundles.length > 0) {
      groups.push({ key: 'OTHER', label: 'Другое', bundles: otherBundles })
    }
    return groups
  }, [filteredBundles, statusLabels])

  const assigneeGroups = useMemo((): Section[] => {
    const map = new Map<string, { key: string; label: string; bundles: TaskBundle[] }>()
    for (const b of filteredBundles) {
      const id = bundleAssigneeSectionKey(b)
      const label = bundleAssigneeSectionLabel(b, currentUserId)
      if (!map.has(id)) map.set(id, { key: id, label, bundles: [] })
      map.get(id)!.bundles.push(b)
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
  }, [filteredBundles, currentUserId])

  const tableColSpan = isAdmin ? 8 : 7
  const sections = !canGroupByAssignee || groupBy === 'status' ? statusGroups : assigneeGroups

  const exportTasks = useMemo(() => filteredBundles.map(bundleToExportTask), [filteredBundles])

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

  function renderEngineersCell(bundle: TaskBundle) {
    const rep = getRepresentativeTask(bundle)
    const sorted = sortBundleTasksForDisplay(bundle)
    const others = sorted.slice(1)
    const multi = bundle.tasks.length > 1
    const namesLine2 = others
      .map((t) => t.assignedTo?.name)
      .filter(Boolean) as string[]
    const showPlus = namesLine2.length > 2
    const line2 = showPlus ? namesLine2.slice(0, 2).join(', ') : namesLine2.join(', ')
    const plusN = showPlus ? namesLine2.length - 2 : 0

    return (
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
          <span className="font-medium text-gray-900 truncate">
            {rep.assignedTo?.name || <span className="text-gray-400 font-normal">Не назначен</span>}
          </span>
          {multi && bundle.sourceTaskId && rep.id === bundle.sourceTaskId && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700 shrink-0">
              Ответственный
            </span>
          )}
        </div>
        {multi && namesLine2.length > 0 && (
          <div className="text-xs text-gray-500 leading-snug">
            <span>{line2}</span>
            {plusN > 0 && <span className="text-gray-400"> · +{plusN}</span>}
          </div>
        )}
      </div>
    )
  }

  function renderMobileBundleCard(bundle: TaskBundle) {
    const rep = getRepresentativeTask(bundle)
    const multi = bundle.tasks.length > 1
    const hrefId = bundle.sourceTaskId || rep.id
    const busy = bundle.tasks.some((t) => busyId === t.id)
    const ageBorder = taskAgeBorderClass(rep.status, rep.createdAt)
    const multiShell = multi ? 'border-indigo-200 bg-indigo-50/25 ring-1 ring-indigo-100/80' : ''

    return (
      <div
        key={bundle.key}
        className={`border rounded-lg p-3 bg-white ${multiShell} ${ageBorder}`}
      >
        <a href={`/tasks/${hrefId}`} className="block">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium text-sm">
              <span className={`mr-1 ${priorityColors[rep.priority]}`}>●</span>
              №{rep.requestNumber} · {typeLabels[rep.type] || rep.type}
              {rep.taskType === 'LONG_TERM' && (
                <span className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-200" title="Долгосрочная">
                  📅 Долгоср.
                </span>
              )}
              {multi && <BundleEngineerCountBadge bundle={bundle} />}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[rep.status] || 'bg-gray-100 text-gray-800'}`}
              >
                {statusLabels[rep.status] || rep.status}
              </span>
              {rep.status === 'DONE' && rep.report && !rep.report.clientSignature && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-200 text-right">
                  Нет подписи клиента
                </span>
              )}
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-700">
            {rep.equipment.brand} {rep.equipment.model}
          </div>
          <div className="text-xs text-gray-500">{rep.equipment.serialNumber}</div>
          <div className="mt-2 text-xs text-gray-600">Клиент: {rep.equipment.object.branch.client.name}</div>
          <div className="mt-1 text-xs text-gray-700 space-y-0.5">
            <div className="font-medium text-gray-800">Инженеры</div>
            {renderEngineersCell(bundle)}
          </div>
          <div
            className={`text-xs mt-1 ${isTaskEndDateOverdue(rep) ? 'text-red-600 font-semibold' : 'text-gray-600'}`}
          >
            Срок: {formatTaskScheduleRangeRu(rep)}
          </div>
        </a>
        <div className="mt-3">
          <a
            href={getYandexRouteUrl(rep)}
            target="_blank"
            rel="noreferrer"
            className="w-full min-h-11 inline-flex items-center justify-center gap-1 border border-amber-200 text-amber-700 px-2.5 py-1 rounded text-xs hover:bg-amber-50"
          >
            📍 Маршрут в Яндекс
          </a>
        </div>
        {isAdmin && (
          <div className="mt-3 flex flex-col gap-2">
            {!['DONE', 'CANCELLED'].includes(rep.status) && (
              <button
                type="button"
                onClick={() => void cancelTask(rep.id)}
                disabled={busy}
                className="w-full min-h-11 border border-orange-200 text-orange-700 px-2.5 py-1 rounded text-xs hover:bg-orange-50 disabled:opacity-50"
              >
                Отменить
              </button>
            )}
            {!bundle.tasks.some((t) => t.report) && (
              <button
                type="button"
                onClick={() => void deleteTask(rep.id)}
                disabled={busy}
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

  function renderDesktopBundleRow(bundle: TaskBundle) {
    const rep = getRepresentativeTask(bundle)
    const multi = bundle.tasks.length > 1
    const hrefId = bundle.sourceTaskId || rep.id
    const busy = bundle.tasks.some((t) => busyId === t.id)
    const ageBorder = taskAgeBorderClass(rep.status, rep.createdAt)
    const delegateFrame =
      multi && !ageBorder ? 'border-l-4 border-indigo-300 bg-indigo-50/20' : multi ? 'bg-indigo-50/20' : ''

    return (
      <tr
        key={bundle.key}
        className={`border-b last:border-0 hover:bg-gray-50 cursor-pointer ${ageBorder} ${delegateFrame}`}
        onClick={() => {
          window.location.href = `/tasks/${hrefId}`
        }}
      >
        <td className="p-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className={`font-medium ${priorityColors[rep.priority]}`}>●</span>
            <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span>
                №{rep.requestNumber} · {typeLabels[rep.type] || rep.type}
              </span>
              {rep.taskType === 'LONG_TERM' && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-200" title="Долгосрочная задача">
                  📅 Долгосрочная
                </span>
              )}
            </span>
            {multi && <BundleEngineerCountBadge bundle={bundle} />}
          </div>
        </td>
        <td className="p-3">
          <div>
            {rep.equipment.brand} {rep.equipment.model}
          </div>
          <div className="text-xs text-gray-500">{rep.equipment.serialNumber}</div>
        </td>
        <td className="p-3 text-gray-600">{rep.equipment.object.branch.client.name}</td>
        <td className="p-3 text-gray-600 max-w-[14rem]">{renderEngineersCell(bundle)}</td>
        <td className={`p-3 ${isTaskEndDateOverdue(rep) ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
          {formatTaskScheduleRangeRu(rep)}
        </td>
        <td className="p-3">
          <div className="flex flex-col gap-1 items-start">
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[rep.status] || 'bg-gray-100 text-gray-800'}`}
            >
              {statusLabels[rep.status] || rep.status}
            </span>
            {rep.status === 'DONE' && rep.report && !rep.report.clientSignature && (
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-200 max-w-[11rem] leading-tight">
                Нет подписи клиента
              </span>
            )}
          </div>
        </td>
        <td className="p-3">
          <a
            href={getYandexRouteUrl(rep)}
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
              {!['DONE', 'CANCELLED'].includes(rep.status) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    void cancelTask(rep.id)
                  }}
                  disabled={busy}
                  className="border border-orange-200 text-orange-700 px-2 py-1 rounded text-xs hover:bg-orange-50 disabled:opacity-50"
                >
                  Отменить
                </button>
              )}
              {!bundle.tasks.some((t) => t.report) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    void deleteTask(rep.id)
                  }}
                  disabled={busy}
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
      <div className="flex flex-col gap-2 px-3 py-2 md:px-4 border-b bg-slate-50/80">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
          <div className="flex flex-wrap items-center gap-2">
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
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:border-l sm:border-slate-200 sm:pl-3">
            <span className="text-xs font-medium text-slate-600">Срок</span>
            <select
              value={filterYear === 'all' ? 'all' : String(filterYear)}
              onChange={(e) => {
                const v = e.target.value
                setFilterYear(v === 'all' ? 'all' : Number(v))
              }}
              className="text-sm border rounded-lg px-2 py-1.5 bg-white min-w-[7rem]"
              aria-label="Год срока"
            >
              <option value="all">Все годы</option>
              {yearOptions.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
            <select
              value={filterMonth === 'all' ? 'all' : String(filterMonth)}
              onChange={(e) => {
                const v = e.target.value
                setFilterMonth(v === 'all' ? 'all' : Number(v))
              }}
              className="text-sm border rounded-lg px-2 py-1.5 bg-white min-w-[9.5rem]"
              aria-label="Месяц срока"
            >
              <option value="all">Все месяцы</option>
              {MONTHS_RU.map((label, i) => (
                <option key={label} value={String(i + 1)}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={filterDay === 'all' ? 'all' : String(filterDay)}
              onChange={(e) => {
                const v = e.target.value
                setFilterDay(v === 'all' ? 'all' : Number(v))
              }}
              className="text-sm border rounded-lg px-2 py-1.5 bg-white min-w-[6.5rem]"
              aria-label="Число срока"
            >
              <option value="all">Все числа</option>
              {dayOptions.map((d) => (
                <option key={d} value={String(d)}>
                  {d}
                </option>
              ))}
            </select>
            {(filterYear !== 'all' || filterMonth !== 'all' || filterDay !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setFilterYear('all')
                  setFilterMonth('all')
                  setFilterDay('all')
                }}
                className="text-xs text-blue-600 hover:text-blue-800 hover:underline px-1"
              >
                Сбросить
              </button>
            )}
          </div>
          <ExportTasksButton tasks={exportTasks} typeLabels={typeLabels} statusLabels={statusLabels} />
          <span
            className="text-xs text-slate-600 max-w-full leading-snug sm:border-l sm:border-slate-200 sm:pl-3"
            title="Для статусов «Назначена» и «В работе» по дате создания задачи"
          >
            🟢 Сегодня · 🟡 Вчера · 🔴 2+ дней
          </span>
          <span className="text-xs text-slate-400 sm:ml-auto">
            Всего: {filteredBundles.length}
            {filteredBundles.length !== allBundles.length && (
              <span className="text-slate-300"> · из {allBundles.length}</span>
            )}
          </span>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-400">Нет задач</div>
      ) : filteredBundles.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-500 space-y-2">
          <p>Нет задач с выбранным сроком.</p>
          <button
            type="button"
            onClick={() => {
              setFilterYear('all')
              setFilterMonth('all')
              setFilterDay('all')
            }}
            className="text-sm text-blue-600 hover:underline"
          >
            Показать все задачи
          </button>
        </div>
      ) : (
        <>
          <div className="md:hidden divide-y divide-gray-100 bg-white">
            {sections.map((section) => (
              <div key={section.key}>
                <div className="sticky top-0 z-10 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 border-b border-slate-200">
                  {section.label}
                  <span className="text-slate-400 font-normal"> · {section.bundles.length}</span>
                </div>
                <div className="space-y-3 p-3">
                  {section.bundles.map((bundle) => renderMobileBundleCard(bundle))}
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
                    <span className="text-slate-400 font-normal"> · {section.bundles.length}</span>
                  </td>
                </tr>
                {section.bundles.map((bundle) => renderDesktopBundleRow(bundle))}
              </tbody>
            ))}
          </table>
        </>
      )}
    </div>
  )
}

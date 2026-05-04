'use client'

import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'

type Engineer = { id: string; name: string; role: string }
type TaskRow = {
  id: string
  requestNumber: number
  type: string
  status: string
  createdAt: string
  completedAt: string | null
  equipment: {
    id: string
    brand: string
    model: string
    serialNumber: string
    object: { branch: { client: { name: string } } }
  }
}
type EngineerBlock = { engineerId: string; engineerName: string; engineerRole: string; tasks: TaskRow[] }

type EquipmentOption = {
  id: string
  brand: string
  model: string
  serialNumber: string
}

const TYPE_LABELS: Record<string, string> = {
  PLANNED_MAINTENANCE: 'Плановое ТО',
  DIAGNOSTICS: 'Диагностика',
  WARRANTY_REPAIR: 'Гарантийный ремонт',
  EMERGENCY: 'Аварийная',
  INSTALLATION: 'Монтаж',
  COMMISSIONING: 'Пусконаладка',
}

function localISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function humanDuration(fromIso: string, toIso: string | null) {
  if (!toIso) return '—'
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime()
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  const h = Math.floor(ms / (1000 * 60 * 60))
  const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  return `${h} ч ${m} мин`
}

function equipmentLabel(eq: EquipmentOption): string {
  const core = `${eq.brand} ${eq.model}`.trim()
  return `${core} (${eq.serialNumber})`
}

export default function HistoryClient() {
  const today = new Date()
  const [dateFrom, setDateFrom] = useState(() => localISODate(new Date(today.getFullYear(), today.getMonth(), 1)))
  const [dateTo, setDateTo] = useState(() => localISODate(today))
  const [engineerId, setEngineerId] = useState('ALL')
  const [taskType, setTaskType] = useState('ALL')
  const [equipmentId, setEquipmentId] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [engineers, setEngineers] = useState<Engineer[]>([])
  const [equipmentList, setEquipmentList] = useState<EquipmentOption[]>([])
  const [grouped, setGrouped] = useState<EngineerBlock[]>([])
  const [stats, setStats] = useState<{
    totalDone: number
    avgPerEngineer: number
    topEngineer: { id: string; name: string; taskCount: number } | null
  }>({
    totalDone: 0,
    avgPerEngineer: 0,
    topEngineer: null,
  })

  useEffect(() => {
    let cancelled = false
    async function loadEquipment() {
      try {
        const res = await fetch('/api/equipment')
        if (!res.ok) return
        const data = (await res.json()) as EquipmentOption[]
        if (!cancelled && Array.isArray(data)) {
          setEquipmentList(
            data.map((e) => ({
              id: e.id,
              brand: e.brand ?? '',
              model: e.model ?? '',
              serialNumber: e.serialNumber ?? '',
            }))
          )
        }
      } catch {
        /* ignore */
      }
    }
    void loadEquipment()
    return () => {
      cancelled = true
    }
  }, [])

  const dateRangeValid = useMemo(() => {
    const a = new Date(dateFrom + 'T00:00:00')
    const b = new Date(dateTo + 'T00:00:00')
    return Number.isFinite(a.getTime()) && Number.isFinite(b.getTime()) && a.getTime() <= b.getTime()
  }, [dateFrom, dateTo])

  useEffect(() => {
    if (!dateRangeValid) {
      setLoading(false)
      setGrouped([])
      setStats({ totalDone: 0, avgPerEngineer: 0, topEngineer: null })
      return
    }
    async function load() {
      setLoading(true)
      const params = new URLSearchParams({
        dateFrom,
        dateTo,
      })
      if (engineerId !== 'ALL') params.set('engineerId', engineerId)
      if (taskType !== 'ALL') params.set('taskType', taskType)
      if (equipmentId !== 'ALL') params.set('equipmentId', equipmentId)

      const res = await fetch(`/api/tasks/completed-history?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) {
        setGrouped([])
        setStats({ totalDone: 0, avgPerEngineer: 0, topEngineer: null })
        setLoading(false)
        return
      }
      setEngineers(data.engineers || [])
      setGrouped(data.grouped || [])
      setStats(data.stats || { totalDone: 0, avgPerEngineer: 0, topEngineer: null })
      setLoading(false)
    }
    void load()
  }, [dateFrom, dateTo, engineerId, taskType, equipmentId, dateRangeValid])

  const allRows = useMemo(
    () =>
      grouped.flatMap((block) =>
        block.tasks.map((task) => ({
          Инженер: block.engineerName,
          'Дата выполнения': task.completedAt ? new Date(task.completedAt).toLocaleDateString('ru-RU') : '—',
          '№ заявки': task.requestNumber,
          'Тип задачи': TYPE_LABELS[task.type] || task.type,
          Оборудование: `${task.equipment.brand} ${task.equipment.model} (${task.equipment.serialNumber})`,
          Клиент: task.equipment.object.branch.client.name,
          Статус: 'DONE',
          'Время выполнения': humanDuration(task.createdAt, task.completedAt),
        }))
      ),
    [grouped]
  )

  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(allRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'История')
    XLSX.writeFile(wb, `История_задач_${dateFrom}_${dateTo}.xlsx`)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-xl p-4">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <h1 className="text-xl md:text-2xl font-bold">История выполненных задач</h1>
          <div className="flex flex-col gap-2 w-full lg:w-auto">
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-end">
              <label className="flex flex-col gap-1 text-xs text-gray-600 min-w-0 sm:min-w-[10.5rem]">
                <span>От</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="min-h-11 border rounded-lg px-2 py-2 text-sm bg-white w-full"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-600 min-w-0 sm:min-w-[10.5rem]">
                <span>До</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="min-h-11 border rounded-lg px-2 py-2 text-sm bg-white w-full"
                />
              </label>
              <select
                value={engineerId}
                onChange={(e) => setEngineerId(e.target.value)}
                className="w-full sm:w-auto min-h-11 border rounded-lg px-3 py-2 text-sm bg-white sm:min-w-[12rem]"
              >
                <option value="ALL">Все инженеры</option>
                {engineers.map((eng) => (
                  <option key={eng.id} value={eng.id}>
                    {eng.name}
                    {eng.role === 'CHIEF_ENGINEER' ? ' (гл. инженер)' : ''}
                  </option>
                ))}
              </select>
              <select
                value={equipmentId}
                onChange={(e) => setEquipmentId(e.target.value)}
                className="w-full sm:flex-1 sm:min-w-[14rem] min-h-11 border rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="ALL">Всё оборудование</option>
                {equipmentList.map((eq) => (
                  <option key={eq.id} value={eq.id} title={equipmentLabel(eq)}>
                    {equipmentLabel(eq).length > 72 ? `${equipmentLabel(eq).slice(0, 69)}…` : equipmentLabel(eq)}
                  </option>
                ))}
              </select>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                className="w-full sm:w-auto min-h-11 border rounded-lg px-3 py-2 text-sm bg-white sm:min-w-[11rem]"
              >
                <option value="ALL">Все типы</option>
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <button
                onClick={exportExcel}
                disabled={!dateRangeValid || grouped.length === 0}
                className="w-full sm:w-auto min-h-11 border px-4 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none"
              >
                📥 Экспорт в Excel
              </button>
            </div>
            {!dateRangeValid && (
              <p className="text-xs text-red-600">Дата «От» не может быть позже даты «До».</p>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border rounded-xl p-6 text-sm text-gray-500">Загрузка истории...</div>
      ) : !dateRangeValid ? (
        <div className="bg-white border rounded-xl p-8 text-sm text-amber-700 text-center">Исправьте диапазон дат.</div>
      ) : grouped.length === 0 ? (
        <div className="bg-white border rounded-xl p-8 text-sm text-gray-400 text-center">За выбранный период выполненных задач нет</div>
      ) : (
        <div className="space-y-3">
          {grouped.map((block) => (
            <details key={block.engineerId} open className="bg-white border rounded-xl overflow-hidden">
              <summary className="list-none cursor-pointer p-4 border-b bg-gray-50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                    {block.engineerName.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-semibold">{block.engineerName}</span>
                  {block.engineerRole === 'CHIEF_ENGINEER' && (
                    <span className="text-[10px] font-medium uppercase text-slate-500">гл. инженер</span>
                  )}
                  <span className="text-xs text-gray-500">· выполнено: {block.tasks.length}</span>
                </div>
              </summary>
              <div className="md:hidden p-3 space-y-2">
                {block.tasks.map((task) => (
                  <div key={task.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">
                        №{task.requestNumber} · {TYPE_LABELS[task.type] || task.type}
                      </div>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">DONE</span>
                    </div>
                    <div className="mt-2 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-500">Дата</span>
                        <span className="text-gray-700">
                          {task.completedAt ? new Date(task.completedAt).toLocaleDateString('ru-RU') : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-500">Оборудование</span>
                        <span className="text-gray-700 text-right">
                          {task.equipment.brand} {task.equipment.model}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-500">Клиент</span>
                        <span className="text-gray-700 text-right">{task.equipment.object.branch.client.name}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-500">Время</span>
                        <span className="text-gray-700">{humanDuration(task.createdAt, task.completedAt)}</span>
                      </div>
                    </div>
                    <a
                      href={`/tasks/${task.id}`}
                      className="mt-2 w-full min-h-11 inline-flex items-center justify-center border rounded-lg text-sm text-blue-600 hover:bg-blue-50"
                    >
                      Просмотр
                    </a>
                  </div>
                ))}
              </div>
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-[900px] w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left p-3 font-medium">Дата выполнения</th>
                      <th className="text-left p-3 font-medium">Тип задачи</th>
                      <th className="text-left p-3 font-medium">Оборудование</th>
                      <th className="text-left p-3 font-medium">Клиент</th>
                      <th className="text-left p-3 font-medium">Статус</th>
                      <th className="text-left p-3 font-medium">Время выполнения</th>
                      <th className="text-left p-3 font-medium">Действие</th>
                    </tr>
                  </thead>
                  <tbody>
                    {block.tasks.map((task) => (
                      <tr key={task.id} className="border-b last:border-0">
                        <td className="p-3">
                          {task.completedAt ? new Date(task.completedAt).toLocaleDateString('ru-RU') : '—'}
                        </td>
                        <td className="p-3">
                          №{task.requestNumber} · {TYPE_LABELS[task.type] || task.type}
                        </td>
                        <td className="p-3">
                          {task.equipment.brand} {task.equipment.model}
                        </td>
                        <td className="p-3">{task.equipment.object.branch.client.name}</td>
                        <td className="p-3">
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">DONE</span>
                        </td>
                        <td className="p-3">{humanDuration(task.createdAt, task.completedAt)}</td>
                        <td className="p-3">
                          <a href={`/tasks/${task.id}`} className="text-blue-600 hover:underline">
                            Просмотр
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
      )}

      <div className="bg-white border rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <div>
          <div className="text-gray-500">Всего выполнено за период</div>
          <div className="text-2xl font-bold">{stats.totalDone}</div>
        </div>
        <div>
          <div className="text-gray-500">Среднее на инженера</div>
          <div className="text-2xl font-bold">{stats.avgPerEngineer.toFixed(1)}</div>
          <p className="text-[11px] text-gray-400 mt-1 leading-snug">Без учёта главного инженера (роль CHIEF_ENGINEER)</p>
        </div>
        <div>
          <div className="text-gray-500">Самый загруженный инженер</div>
          <div className="text-lg font-semibold">
            {stats.topEngineer ? `${stats.topEngineer.name} (${stats.topEngineer.taskCount})` : '—'}
          </div>
          <p className="text-[11px] text-gray-400 mt-1 leading-snug">Среди инженеров (ENGINEER), без гл. инженера</p>
        </div>
      </div>
    </div>
  )
}

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
    brand: string
    model: string
    serialNumber: string
    object: { branch: { client: { name: string } } }
  }
}
type EngineerBlock = { engineerId: string; engineerName: string; tasks: TaskRow[] }

const TYPE_LABELS: Record<string, string> = {
  PLANNED_MAINTENANCE: 'Плановое ТО',
  DIAGNOSTICS: 'Диагностика',
  WARRANTY_REPAIR: 'Гарантийный ремонт',
  EMERGENCY: 'Аварийная',
  INSTALLATION: 'Монтаж',
  COMMISSIONING: 'Пусконаладка',
}

function monthTitle(year: number, month: number) {
  const d = new Date(year, month - 1, 1)
  return d.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })
}

function humanDuration(fromIso: string, toIso: string | null) {
  if (!toIso) return '—'
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime()
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  const h = Math.floor(ms / (1000 * 60 * 60))
  const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  return `${h} ч ${m} мин`
}

export default function HistoryClient() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [engineerId, setEngineerId] = useState('ALL')
  const [taskType, setTaskType] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [engineers, setEngineers] = useState<Engineer[]>([])
  const [grouped, setGrouped] = useState<EngineerBlock[]>([])
  const [stats, setStats] = useState<{ totalDone: number; avgPerEngineer: number; topEngineer: { id: string; name: string; taskCount: number } | null }>({
    totalDone: 0,
    avgPerEngineer: 0,
    topEngineer: null,
  })

  useEffect(() => {
    async function load() {
      setLoading(true)
      const params = new URLSearchParams({
        month: String(month),
        year: String(year),
      })
      if (engineerId !== 'ALL') params.set('engineerId', engineerId)
      if (taskType !== 'ALL') params.set('taskType', taskType)

      const res = await fetch(`/api/tasks/completed-history?${params.toString()}`)
      const data = await res.json()
      setEngineers(data.engineers || [])
      setGrouped(data.grouped || [])
      setStats(data.stats || { totalDone: 0, avgPerEngineer: 0, topEngineer: null })
      setLoading(false)
    }
    void load()
  }, [month, year, engineerId, taskType])

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

  function changeMonth(delta: number) {
    const next = new Date(year, month - 1 + delta, 1)
    setMonth(next.getMonth() + 1)
    setYear(next.getFullYear())
  }

  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(allRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'История')
    XLSX.writeFile(wb, `История_задач_${month}_${year}.xlsx`)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-xl p-4">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <h1 className="text-xl md:text-2xl font-bold">История выполненных задач</h1>
          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            <div className="w-full sm:w-auto inline-flex items-center rounded-lg border bg-white">
              <button className="min-h-11 px-3 py-2 text-sm hover:bg-gray-50" onClick={() => changeMonth(-1)}>{'<'}</button>
              <span className="px-3 py-2 text-sm font-medium min-w-[180px] text-center capitalize">{monthTitle(year, month)}</span>
              <button className="min-h-11 px-3 py-2 text-sm hover:bg-gray-50" onClick={() => changeMonth(1)}>{'>'}</button>
            </div>
            <select value={engineerId} onChange={(e) => setEngineerId(e.target.value)} className="w-full sm:w-auto min-h-11 border rounded-lg px-3 py-2 text-sm bg-white">
              <option value="ALL">Все инженеры</option>
              {engineers.map((eng) => (
                <option key={eng.id} value={eng.id}>
                  {eng.name}
                </option>
              ))}
            </select>
            <select value={taskType} onChange={(e) => setTaskType(e.target.value)} className="w-full sm:w-auto min-h-11 border rounded-lg px-3 py-2 text-sm bg-white">
              <option value="ALL">Все типы</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <button onClick={exportExcel} className="w-full sm:w-auto min-h-11 border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
              📥 Экспорт в Excel
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border rounded-xl p-6 text-sm text-gray-500">Загрузка истории...</div>
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
                  <span className="text-xs text-gray-500">· выполнено: {block.tasks.length}</span>
                </div>
              </summary>
              <div className="md:hidden p-3 space-y-2">
                {block.tasks.map((task) => (
                  <div key={task.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">№{task.requestNumber} · {TYPE_LABELS[task.type] || task.type}</div>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">DONE</span>
                    </div>
                    <div className="mt-2 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2"><span className="text-gray-500">Дата</span><span className="text-gray-700">{task.completedAt ? new Date(task.completedAt).toLocaleDateString('ru-RU') : '—'}</span></div>
                      <div className="flex items-center justify-between gap-2"><span className="text-gray-500">Оборудование</span><span className="text-gray-700 text-right">{task.equipment.brand} {task.equipment.model}</span></div>
                      <div className="flex items-center justify-between gap-2"><span className="text-gray-500">Клиент</span><span className="text-gray-700 text-right">{task.equipment.object.branch.client.name}</span></div>
                      <div className="flex items-center justify-between gap-2"><span className="text-gray-500">Время</span><span className="text-gray-700">{humanDuration(task.createdAt, task.completedAt)}</span></div>
                    </div>
                    <a href={`/tasks/${task.id}`} className="mt-2 w-full min-h-11 inline-flex items-center justify-center border rounded-lg text-sm text-blue-600 hover:bg-blue-50">
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
                        <td className="p-3">{task.completedAt ? new Date(task.completedAt).toLocaleDateString('ru-RU') : '—'}</td>
                        <td className="p-3">№{task.requestNumber} · {TYPE_LABELS[task.type] || task.type}</td>
                        <td className="p-3">{task.equipment.brand} {task.equipment.model}</td>
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
        </div>
        <div>
          <div className="text-gray-500">Самый загруженный инженер</div>
          <div className="text-lg font-semibold">{stats.topEngineer ? `${stats.topEngineer.name} (${stats.topEngineer.taskCount})` : '—'}</div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'

type Engineer = { id: string; name: string; role: string }
type ScheduleTask = {
  id: string
  type: string
  priority: string
  status: string
  taskType?: string
  scheduledAt: string | null
  startDate?: string | null
  endDate?: string | null
  equipment: { brand: string; model: string; serialNumber: string }
}
type ScheduleEntry = {
  engineerId: string
  engineerName: string
  date: string
  taskCount: number
  tasks: ScheduleTask[]
}

const TYPE_LABELS: Record<string, string> = {
  PLANNED_MAINTENANCE: 'Плановое ТО',
  DIAGNOSTICS: 'Диагностика',
  WARRANTY_REPAIR: 'Гарантийный ремонт',
  EMERGENCY: 'Аварийный выезд',
  INSTALLATION: 'Монтаж',
  COMMISSIONING: 'Пусконаладка',
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function monthTitle(year: number, month: number) {
  const date = new Date(year, month - 1, 1)
  return date.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })
}

export default function EngineersScheduleClient() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [engineerFilter, setEngineerFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [engineers, setEngineers] = useState<Engineer[]>([])
  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [selectedCell, setSelectedCell] = useState<{ engineerName: string; day: number; tasks: ScheduleTask[] } | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ month: String(month), year: String(year) })
      if (engineerFilter !== 'ALL') params.set('engineerId', engineerFilter)
      try {
        const res = await fetch(`/api/tasks/engineer-schedule?${params.toString()}`)
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}))
          setError((payload as { error?: string }).error || 'Не удалось загрузить график')
          setEngineers([])
          setEntries([])
          return
        }
        const data = await res.json()
        setEngineers(Array.isArray(data.engineers) ? data.engineers : [])
        setEntries(Array.isArray(data.schedule) ? data.schedule : [])
      } catch {
        setError('Ошибка сети при загрузке графика')
        setEngineers([])
        setEntries([])
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [month, year, engineerFilter])

  const dayCount = daysInMonth(year, month)
  const days = Array.from({ length: dayCount }, (_, i) => i + 1)

  const grid = useMemo(() => {
    const map = new Map<string, ScheduleEntry>()
    for (const entry of entries) {
      map.set(`${entry.engineerId}|${entry.date}`, entry)
    }
    return map
  }, [entries])

  const visibleEngineers = engineerFilter === 'ALL' ? engineers : engineers.filter((e) => e.id === engineerFilter)

  function cellColor(count: number) {
    if (count === 0) return 'bg-gray-50 text-gray-300'
    if (count === 1) return 'bg-yellow-100 text-yellow-800'
    if (count === 2) return 'bg-orange-100 text-orange-800'
    return 'bg-red-100 text-red-800'
  }

  function changeMonth(delta: number) {
    const next = new Date(year, month - 1 + delta, 1)
    setMonth(next.getMonth() + 1)
    setYear(next.getFullYear())
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-xl p-4">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <h1 className="text-xl md:text-2xl font-bold">График загруженности инженеров</h1>
          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            <div className="w-full sm:w-auto inline-flex items-center rounded-lg border bg-white">
              <button className="min-h-11 px-3 py-2 text-sm hover:bg-gray-50" onClick={() => changeMonth(-1)}>
                {'<'}
              </button>
              <span className="px-3 py-2 text-sm font-medium min-w-[180px] text-center capitalize">{monthTitle(year, month)}</span>
              <button className="min-h-11 px-3 py-2 text-sm hover:bg-gray-50" onClick={() => changeMonth(1)}>
                {'>'}
              </button>
            </div>
            <select
              value={engineerFilter}
              onChange={(e) => setEngineerFilter(e.target.value)}
              className="w-full sm:w-auto min-h-11 border rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="ALL">Все инженеры</option>
              {engineers.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-x-auto">
        {loading ? (
          <div className="p-6 text-sm text-gray-500">Загрузка графика...</div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600">{error}</div>
        ) : visibleEngineers.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">Нет данных за выбранный период</div>
        ) : (
          <table className="min-w-[1000px] w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3 font-medium sticky left-0 bg-gray-50 z-10 min-w-[220px]">Инженер</th>
                {days.map((d) => (
                  <th key={d} className="text-center p-2 font-medium min-w-[36px]">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleEngineers.map((eng) => (
                <tr key={eng.id} className="border-b last:border-0">
                  <td className="p-3 sticky left-0 bg-white z-10">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                        {eng.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium">{eng.name}</span>
                    </div>
                  </td>
                  {days.map((day) => {
                    const dateKey = new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10)
                    const entry = grid.get(`${eng.id}|${dateKey}`)
                    const count = entry?.taskCount ?? 0
                    return (
                      <td key={`${eng.id}-${day}`} className="p-1">
                        <button
                          type="button"
                          onClick={() =>
                            entry &&
                            setSelectedCell({
                              engineerName: eng.name,
                              day,
                              tasks: entry.tasks,
                            })
                          }
                          className={`w-full h-9 rounded text-xs font-semibold ${cellColor(count)} ${count > 0 ? 'hover:ring-2 hover:ring-blue-300' : ''}`}
                          title={count > 0 ? `Задач: ${count}` : 'Нет задач'}
                        >
                          {count > 0 ? count : ''}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedCell && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-xl border w-full md:max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">
                {selectedCell.engineerName} · {selectedCell.day}.{String(month).padStart(2, '0')}.{year}
              </h3>
              <button className="text-gray-400 hover:text-gray-700" onClick={() => setSelectedCell(null)}>
                ✕
              </button>
            </div>
            <div className="p-4 space-y-2">
              {selectedCell.tasks.map((task) => (
                <a key={task.id} href={`/tasks/${task.id}`} className="block border rounded-lg p-3 hover:bg-gray-50">
                  <div className="font-medium text-sm">{TYPE_LABELS[task.type] || task.type}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {task.equipment.brand} {task.equipment.model} · {task.equipment.serialNumber}
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

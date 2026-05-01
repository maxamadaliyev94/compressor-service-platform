'use client'

import { useEffect, useState } from 'react'

type Engineer = {
  id: string
  name: string
  role: string
  engineerStatus: string
  isOnline: boolean
  checkedInAt: string | null
  assignedTasks: Array<{
    id: string
    type: string
    status: string
    equipment: { brand: string; model: string }
  }>
}

const statusView: Record<string, string> = {
  FREE: '🟢 Свободен',
  BUSY: '🔴 Занят',
  OFFLINE: '⚫ Офлайн',
}

export default function EngineersMonitorClient() {
  const [engineers, setEngineers] = useState<Engineer[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const res = await fetch('/api/engineers/status')
    if (!res.ok) return
    const data = await res.json()
    setEngineers(data)
    setLoading(false)
  }

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), 30000)
    return () => clearInterval(id)
  }, [])

  if (loading) return <div className="text-sm text-gray-500">Загрузка...</div>

  return (
    <div className="space-y-3">
      {engineers.map((eng) => (
        <div key={eng.id} className="bg-white border rounded-xl p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <div className="font-medium">{eng.name}</div>
              <div className="text-xs text-gray-500">{eng.role === 'CHIEF_ENGINEER' ? 'Главный инженер' : 'Инженер'}</div>
            </div>
            <div className="text-sm font-medium">{statusView[eng.engineerStatus] || eng.engineerStatus}</div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            Приход: {eng.checkedInAt ? new Date(eng.checkedInAt).toLocaleString('ru-RU') : '—'}
          </div>
          <div className="mt-1 text-xs text-gray-600">
            Текущая задача:{' '}
            {eng.assignedTasks[0]
              ? `${eng.assignedTasks[0].equipment.brand} ${eng.assignedTasks[0].equipment.model} (${eng.assignedTasks[0].status})`
              : 'нет'}
          </div>
        </div>
      ))}
    </div>
  )
}

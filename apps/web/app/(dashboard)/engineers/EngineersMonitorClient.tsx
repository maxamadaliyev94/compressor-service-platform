'use client'

import { useEffect, useState } from 'react'

type Engineer = {
  id: string
  name: string
  avatarUrl: string | null
  role: string
  engineerStatus: string
  isOnline: boolean
  checkedInAt: string | null
  currentTask: {
    id: string
    type: string
    status: string
    equipment: { brand: string; model: string }
  } | null
}

const statusView: Record<string, string> = {
  FREE: 'Свободен',
  BUSY: 'Занят',
  OFFLINE: 'Офлайн',
}

const statusStyle: Record<string, string> = {
  FREE: 'bg-green-100 text-green-700 border-green-200',
  BUSY: 'bg-red-100 text-red-700 border-red-200',
  OFFLINE: 'bg-gray-100 text-gray-600 border-gray-200',
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
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {engineers.map((eng) => (
        <div key={eng.id} className="bg-white border rounded-2xl overflow-hidden shadow-sm">
          <div className="h-28 bg-gradient-to-r from-blue-600 to-cyan-500 p-4 flex items-end">
            {eng.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={eng.avatarUrl}
                alt={eng.name}
                className="w-12 h-12 rounded-full object-cover border-2 border-white/90 bg-white"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-white/95 text-blue-700 font-bold flex items-center justify-center text-lg">
                {eng.name.trim().charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="p-4 space-y-2">
            <div>
              <div className="font-semibold text-slate-900">{eng.name}</div>
              <div className="text-xs text-gray-500">{eng.role === 'CHIEF_ENGINEER' ? 'Главный инженер' : 'Инженер'}</div>
            </div>

            <div
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusStyle[eng.engineerStatus] || 'bg-gray-100 text-gray-600 border-gray-200'}`}
            >
              {statusView[eng.engineerStatus] || eng.engineerStatus}
            </div>

            <div className="text-xs text-gray-600">
              На смене: {eng.checkedInAt ? new Date(eng.checkedInAt).toLocaleString('ru-RU') : '—'}
            </div>
            <div className="text-xs text-gray-600">
              Текущая задача:{' '}
              {eng.currentTask
                ? `${eng.currentTask.equipment.brand} ${eng.currentTask.equipment.model}`
                : '—'}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

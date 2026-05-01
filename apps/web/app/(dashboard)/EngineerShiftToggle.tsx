'use client'

import { useEffect, useState } from 'react'

type Presence = {
  isOnline: boolean
  checkedInAt: string | null
  checkedOutAt: string | null
  engineerStatus: string
}

export default function EngineerShiftToggle() {
  const [presence, setPresence] = useState<Presence | null>(null)
  const [loading, setLoading] = useState(false)

  async function loadPresence() {
    const res = await fetch('/api/engineers/presence')
    if (!res.ok) return
    const data = await res.json()
    setPresence(data)
  }

  useEffect(() => {
    void loadPresence()
  }, [])

  async function update(action: 'checkin' | 'checkout') {
    setLoading(true)
    const res = await fetch('/api/engineers/presence', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    setLoading(false)
    if (!res.ok) return
    const data = await res.json()
    setPresence(data)
  }

  if (!presence) return null

  return (
    <div className="bg-white border rounded-xl p-4 mb-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-sm">
          <div className="font-medium">Статус смены: {presence.isOnline ? 'В смене' : 'Не в смене'}</div>
          <div className="text-xs text-gray-500 mt-1">
            Текущий статус: {presence.engineerStatus}
            {presence.checkedInAt && ` · Приход: ${new Date(presence.checkedInAt).toLocaleString('ru-RU')}`}
          </div>
        </div>
        {presence.isOnline ? (
          <button
            onClick={() => update('checkout')}
            disabled={loading}
            className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
          >
            Завершить смену
          </button>
        ) : (
          <button
            onClick={() => update('checkin')}
            disabled={loading}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
          >
            Начать смену
          </button>
        )}
      </div>
    </div>
  )
}

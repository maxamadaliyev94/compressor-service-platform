'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type Props = {
  initialStart: Date | null
  initialEnd: Date | null
  initialMessage: string | null
}

function toDatetimeLocalValue(d: Date | null): string {
  if (!d) return ''
  const x = new Date(d)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`
}

export function SuperadminMaintenanceSection({
  initialStart,
  initialEnd,
  initialMessage,
}: Props) {
  const router = useRouter()
  const [startLocal, setStartLocal] = useState(() => toDatetimeLocalValue(initialStart))
  const [endLocal, setEndLocal] = useState(() => toDatetimeLocalValue(initialEnd))
  const [message, setMessage] = useState(() => initialMessage ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setStartLocal(toDatetimeLocalValue(initialStart))
    setEndLocal(toDatetimeLocalValue(initialEnd))
    setMessage(initialMessage ?? '')
  }, [initialStart, initialEnd, initialMessage])

  async function schedule() {
    setError('')
    if (!startLocal || !endLocal) {
      setError('Укажите дату и время начала и окончания')
      return
    }
    const startMs = new Date(startLocal).getTime()
    const endMs = new Date(endLocal).getTime()
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      setError('Некорректные дата и время')
      return
    }
    if (endMs <= startMs) {
      setError('Окончание должно быть позже начала')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/superadmin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maintenanceStart: new Date(startLocal).toISOString(),
          maintenanceEnd: new Date(endLocal).toISOString(),
          maintenanceMessage: message.trim() || null,
        }),
      })
      if (!res.ok) {
        setError(res.status === 401 ? 'Ошибка авторизации' : 'Не удалось сохранить')
        return
      }
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function clearSchedule() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/superadmin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maintenanceStart: null,
          maintenanceEnd: null,
          maintenanceMessage: null,
        }),
      })
      if (!res.ok) {
        setError(res.status === 401 ? 'Ошибка авторизации' : 'Не удалось отменить')
        return
      }
      setStartLocal('')
      setEndLocal('')
      setMessage('')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Дата и время начала технических работ
          </label>
          <input
            type="datetime-local"
            value={startLocal}
            onChange={(e) => setStartLocal(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Дата и время окончания технических работ
          </label>
          <input
            type="datetime-local"
            value={endLocal}
            onChange={(e) => setEndLocal(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Текст сообщения</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Например: проводится обновление системы"
            className="w-full border rounded-lg px-3 py-2 text-sm resize-y min-h-[72px]"
          />
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={schedule}
          disabled={loading}
          className="w-full sm:flex-1 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-900 disabled:opacity-50"
        >
          {loading ? 'Сохранение…' : 'Запланировать технические работы'}
        </button>
        <button
          type="button"
          onClick={clearSchedule}
          disabled={loading}
          className="w-full sm:w-auto border border-gray-300 bg-white text-gray-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          Сбросить план
        </button>
      </div>

      <p className="text-xs text-gray-500">
        До начала окна пользователям показывается напоминание с интервалом; за 30 минут — предупреждение о
        сохранении данных. В запланированный интервал вход в приложение закрыт, после окончания доступ
        восстанавливается автоматически.
      </p>
    </div>
  )
}

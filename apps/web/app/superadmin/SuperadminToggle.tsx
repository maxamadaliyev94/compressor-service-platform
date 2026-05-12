'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function SuperadminToggle({ initialActive }: { initialActive: boolean }) {
  const router = useRouter()
  const [active, setActive] = useState(initialActive)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function toggle() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/superadmin/toggle', { method: 'POST' })
      if (!res.ok) {
        setError(res.status === 401 ? 'Ошибка авторизации' : 'Не удалось изменить статус')
        return
      }
      const data = (await res.json()) as { active: boolean }
      setActive(data.active)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-gray-50 px-4 py-3 text-sm">
        Текущее состояние:{' '}
        <strong className={active ? 'text-green-700' : 'text-red-700'}>
          {active ? 'включена' : 'отключена'}
        </strong>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        className={`w-full sm:w-auto px-6 py-3 rounded-lg text-sm font-medium text-white disabled:opacity-50 ${
          active ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
        }`}
      >
        {loading ? 'Сохранение…' : active ? 'Отключить систему' : 'Включить систему'}
      </button>

      <p className="text-xs text-gray-500">
        После отключения все пользователи увидят сообщение о недоступности и не смогут войти в приложение.
      </p>
    </div>
  )
}

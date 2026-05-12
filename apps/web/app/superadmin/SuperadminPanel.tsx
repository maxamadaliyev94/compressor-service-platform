'use client'

import {
  subscriptionDaysRemainingInclusive,
  toDateInputValueUTC,
} from '@/lib/access-policy'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

type Props = {
  initialActive: boolean
  initialGloballyAccessible: boolean
  initialSubscriptionStart: Date | null
  initialSubscriptionEnd: Date | null
}

export function SuperadminPanel({
  initialActive,
  initialGloballyAccessible,
  initialSubscriptionStart,
  initialSubscriptionEnd,
}: Props) {
  const router = useRouter()
  const [active, setActive] = useState(initialActive)
  const [subscriptionStart, setSubscriptionStart] = useState(() =>
    toDateInputValueUTC(initialSubscriptionStart),
  )
  const [subscriptionEnd, setSubscriptionEnd] = useState(() =>
    toDateInputValueUTC(initialSubscriptionEnd),
  )
  const [toggleLoading, setToggleLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setActive(initialActive)
  }, [initialActive])

  useEffect(() => {
    setSubscriptionStart(toDateInputValueUTC(initialSubscriptionStart))
    setSubscriptionEnd(toDateInputValueUTC(initialSubscriptionEnd))
  }, [initialSubscriptionStart, initialSubscriptionEnd])

  const daysRemaining = useMemo(
    () => subscriptionDaysRemainingInclusive(initialSubscriptionEnd ?? null),
    [initialSubscriptionEnd],
  )

  async function saveSubscription() {
    setError('')
    setSaveLoading(true)
    try {
      const res = await fetch('/api/superadmin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionStart: subscriptionStart || null,
          subscriptionEnd: subscriptionEnd || null,
        }),
      })
      if (!res.ok) {
        setError(res.status === 401 ? 'Ошибка авторизации' : 'Не удалось сохранить даты')
        return
      }
      router.refresh()
    } finally {
      setSaveLoading(false)
    }
  }

  async function toggle() {
    setError('')
    setToggleLoading(true)
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
      setToggleLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border bg-gray-50 px-4 py-3 text-sm space-y-1">
        <div>
          Для пользователей:{' '}
          <strong className={initialGloballyAccessible ? 'text-green-700' : 'text-red-700'}>
            {initialGloballyAccessible ? 'доступ открыт' : 'доступ закрыт'}
          </strong>
        </div>
        <div>
          Осталось дней подписки:{' '}
          <strong>{daysRemaining === null ? '—' : daysRemaining}</strong>
          {daysRemaining === 0 && initialSubscriptionEnd != null && (
            <span className="text-red-600 ml-2">(срок по дате истёк)</span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">Подписка</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Дата начала</label>
            <input
              type="date"
              value={subscriptionStart}
              onChange={(e) => setSubscriptionStart(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Дата окончания</label>
            <input
              type="date"
              value={subscriptionEnd}
              onChange={(e) => setSubscriptionEnd(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={saveSubscription}
          disabled={saveLoading}
          className="w-full sm:w-auto bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
        >
          {saveLoading ? 'Сохранение…' : 'Сохранить даты'}
        </button>
      </div>

      <div className="space-y-4 border-t pt-6">
        <h2 className="text-sm font-semibold text-gray-800">Ручное вкл/выкл</h2>
        <div className="rounded-lg border bg-gray-50 px-4 py-3 text-sm">
          Переключатель:{' '}
          <strong className={active ? 'text-green-700' : 'text-red-700'}>
            {active ? 'включён' : 'отключён'}
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
          disabled={toggleLoading}
          className={`w-full sm:w-auto px-6 py-3 rounded-lg text-sm font-medium text-white disabled:opacity-50 ${
            active ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {toggleLoading ? 'Сохранение…' : active ? 'Отключить систему' : 'Включить систему'}
        </button>

        <p className="text-xs text-gray-500">
          При отключённом переключателе или истечении даты окончания подписки пользователи видят страницу
          «Подписка истекла» и не могут войти.
        </p>
      </div>
    </div>
  )
}

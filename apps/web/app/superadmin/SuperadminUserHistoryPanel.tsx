'use client'

import { deviceTypeLabel } from '@/lib/user-agent-hints'
import { useCallback, useEffect, useMemo, useState } from 'react'

type Overview = {
  users: { id: string; name: string; login: string; role: string; loginSuspendedByAdmin: boolean }[]
  sessions: {
    id: string
    userId: string
    userName: string
    login: string
    role: string
    suspended: boolean
    startedAt: string
    lastSeenAt: string
    endedAt: string | null
    ip: string | null
    deviceType: string | null
    browserName: string | null
    city: string | null
    country: string | null
  }[]
  chartHours: number[]
  mostActive: { userId: string; name: string; login: string; role: string; count: number } | null
  timeStats: Record<
    string,
    { todayMs: number; weekMs: number; monthMs: number; todayLabel: string; weekLabel: string; monthLabel: string }
  >
  lastByUser: {
    userId: string
    name: string
    login: string
    role: string
    action: string
    actionLabel: string
    page: string | null
    at: string
  }[]
  actionOptions: { value: string; label: string }[]
}

type LogRow = {
  id: string
  userId: string
  userName: string
  login: string
  role: string
  action: string
  actionLabel: string
  page: string | null
  ip: string | null
  createdAt: string
  suspiciousBurst: boolean
  suspiciousNightLogin: boolean
}

const roleLabels: Record<string, string> = {
  ADMIN: 'Администратор',
  MANAGER: 'Менеджер',
  CHIEF_ENGINEER: 'Главный инженер',
  ENGINEER: 'Инженер',
  CLIENT: 'Клиент',
}

export function SuperadminUserHistoryPanel() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [logs, setLogs] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [logsLoading, setLogsLoading] = useState(false)
  const [err, setErr] = useState('')

  const [filterUserId, setFilterUserId] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const loadOverview = useCallback(async () => {
    setErr('')
    setLoading(true)
    try {
      const res = await fetch('/api/superadmin/activity', { cache: 'no-store' })
      if (!res.ok) {
        setErr(res.status === 401 ? 'Ошибка авторизации' : 'Не удалось загрузить данные')
        return
      }
      setOverview((await res.json()) as Overview)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadLogs = useCallback(async () => {
    if (!overview) return
    setLogsLoading(true)
    try {
      const p = new URLSearchParams({ logs: '1', take: '100' })
      if (filterUserId) p.set('userId', filterUserId)
      if (filterAction) p.set('action', filterAction)
      if (filterFrom) p.set('from', new Date(filterFrom).toISOString())
      if (filterTo) p.set('to', new Date(filterTo).toISOString())
      const res = await fetch(`/api/superadmin/activity?${p}`, { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { logs: LogRow[] }
      setLogs(data.logs)
    } finally {
      setLogsLoading(false)
    }
  }, [overview, filterUserId, filterAction, filterFrom, filterTo])

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])

  useEffect(() => {
    if (overview) void loadLogs()
  }, [overview, loadLogs])

  const maxHour = useMemo(() => Math.max(1, ...((overview?.chartHours as number[]) || [0])), [overview])

  async function revoke(userId: string) {
    if (!confirm('Завершить сессию пользователя?')) return
    const res = await fetch(`/api/superadmin/users/${userId}/revoke-session`, { method: 'POST' })
    if (!res.ok) {
      alert('Не удалось выполнить')
      return
    }
    void loadOverview()
  }

  async function suspend(userId: string, suspended: boolean) {
    const res = await fetch(`/api/superadmin/users/${userId}/suspend`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suspended }),
    })
    if (!res.ok) {
      alert('Не удалось изменить блокировку')
      return
    }
    void loadOverview()
  }

  if (loading && !overview) {
    return <p className="text-sm text-gray-500">Загрузка истории…</p>
  }
  if (!overview) {
    return <p className="text-sm text-red-600">{err || 'Нет данных'}</p>
  }

  return (
    <div className="space-y-6">
      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Пользователь</label>
          <select
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            className="border rounded-lg px-2 py-1.5 text-sm min-w-[160px]"
          >
            <option value="">Все</option>
            {overview.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.login})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Тип действия</label>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="border rounded-lg px-2 py-1.5 text-sm min-w-[180px]"
          >
            <option value="">Все</option>
            {overview.actionOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">С даты</label>
          <input
            type="datetime-local"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="border rounded-lg px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">По дату</label>
          <input
            type="datetime-local"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="border rounded-lg px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => void loadLogs()}
          className="bg-gray-800 text-white text-sm px-3 py-1.5 rounded-lg"
        >
          {logsLoading ? '…' : 'Обновить журнал'}
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="rounded-lg border bg-blue-50/80 p-3 text-sm">
          <div className="font-semibold text-blue-900">Самый активный (30 дней)</div>
          {overview.mostActive ? (
            <div className="mt-1 text-blue-800">
              {overview.mostActive.name} — {overview.mostActive.count} событий
            </div>
          ) : (
            <div className="mt-1 text-gray-600">Нет данных</div>
          )}
        </div>
        <div className="rounded-lg border p-3 text-sm text-gray-700 sm:col-span-2">
          <div className="font-semibold text-gray-900 mb-1">Время в системе (оценка по сессиям)</div>
          <p className="text-xs text-gray-500 mb-2">
            Сумма пересечений сессий с интервалом; локальные сутки сервера для «сегодня».
          </p>
          <div className="max-h-40 overflow-y-auto space-y-0.5 text-xs">
            {overview.users.map((u) => {
              const t = overview.timeStats[u.id]
              if (!t) return null
              return (
                <div key={u.id} className="flex justify-between gap-2 border-b border-gray-100 py-0.5">
                  <span className="truncate">{u.name}</span>
                  <span className="shrink-0 text-gray-600">
                    день {t.todayLabel} · нед {t.weekLabel} · мес {t.monthLabel}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Активность по часам (14 дней)</h3>
        <div className="flex items-end gap-0.5 h-28 border-b border-gray-200 pb-1">
          {overview.chartHours.map((c, h) => (
            <div key={h} className="flex-1 flex flex-col items-center justify-end group relative min-w-0">
              <div
                className="w-full max-w-[14px] mx-auto bg-indigo-400 rounded-t"
                style={{ height: `${Math.max(4, (c / maxHour) * 100)}%` }}
                title={`${h}:00 — ${c}`}
              />
              <span className="text-[9px] text-gray-500 mt-0.5">{h}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Последняя активность по пользователям</h3>
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left p-2">Пользователь</th>
                <th className="text-left p-2">Роль</th>
                <th className="text-left p-2">Действие</th>
                <th className="text-left p-2">Страница</th>
                <th className="text-left p-2">Когда</th>
              </tr>
            </thead>
            <tbody>
              {overview.lastByUser.map((r) => (
                <tr key={r.userId} className="border-t">
                  <td className="p-2">{r.name}</td>
                  <td className="p-2">{roleLabels[r.role] || r.role}</td>
                  <td className="p-2">{r.actionLabel}</td>
                  <td className="p-2">{r.page || '—'}</td>
                  <td className="p-2 whitespace-nowrap">{new Date(r.at).toLocaleString('ru-RU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Сессии (устройство, браузер, гео)</h3>
        <div className="overflow-x-auto border rounded-lg max-h-64 overflow-y-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 text-gray-600 sticky top-0">
              <tr>
                <th className="text-left p-2">Пользователь</th>
                <th className="text-left p-2">Устройство</th>
                <th className="text-left p-2">Браузер</th>
                <th className="text-left p-2">Город</th>
                <th className="text-left p-2">IP</th>
                <th className="text-left p-2">Статус</th>
                <th className="text-left p-2">Действия</th>
              </tr>
            </thead>
            <tbody>
              {overview.sessions.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="p-2">
                    {s.userName}
                    {(overview.users.find((u) => u.id === s.userId)?.loginSuspendedByAdmin ?? false) ? (
                      <span className="text-red-600 ml-1">(блок)</span>
                    ) : null}
                  </td>
                  <td className="p-2">{deviceTypeLabel(s.deviceType)}</td>
                  <td className="p-2">{s.browserName || '—'}</td>
                  <td className="p-2">
                    {s.city || '—'}
                    {s.country ? `, ${s.country}` : ''}
                  </td>
                  <td className="p-2 font-mono">{s.ip || '—'}</td>
                  <td className="p-2">{s.endedAt ? 'Завершена' : 'Активна'}</td>
                  <td className="p-2 space-x-1 whitespace-nowrap">
                    {!s.endedAt ? (
                      <button
                        type="button"
                        className="text-blue-700 underline"
                        onClick={() => void revoke(s.userId)}
                      >
                        Выйти
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="text-orange-700 underline"
                      onClick={() => {
                        const uRow = overview.users.find((u) => u.id === s.userId)
                        const suspended = uRow?.loginSuspendedByAdmin ?? false
                        void suspend(s.userId, !suspended)
                      }}
                    >
                      {(overview.users.find((u) => u.id === s.userId)?.loginSuspendedByAdmin ?? false)
                        ? 'Разблок.'
                        : 'Блок'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Журнал действий</h3>
        <p className="text-xs text-gray-500 mb-2">
          Красная строка — подозрительно: много удалений за 10 минут или вход ночью (после 23:00).
        </p>
        <div className="overflow-x-auto border rounded-lg max-h-80 overflow-y-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 text-gray-600 sticky top-0">
              <tr>
                <th className="text-left p-2">Когда</th>
                <th className="text-left p-2">Пользователь</th>
                <th className="text-left p-2">Роль</th>
                <th className="text-left p-2">Действие</th>
                <th className="text-left p-2">Страница</th>
                <th className="text-left p-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((r) => {
                const bad = r.suspiciousBurst || r.suspiciousNightLogin
                return (
                  <tr key={r.id} className={`border-t ${bad ? 'bg-red-50 text-red-900' : ''}`}>
                    <td className="p-2 whitespace-nowrap">{new Date(r.createdAt).toLocaleString('ru-RU')}</td>
                    <td className="p-2">{r.userName}</td>
                    <td className="p-2">{roleLabels[r.role] || r.role}</td>
                    <td className="p-2">
                      {r.actionLabel}
                      {r.suspiciousBurst ? (
                        <span className="block text-[10px] font-semibold">много удалений</span>
                      ) : null}
                      {r.suspiciousNightLogin ? (
                        <span className="block text-[10px] font-semibold">ночной вход</span>
                      ) : null}
                    </td>
                    <td className="p-2">{r.page || '—'}</td>
                    <td className="p-2 font-mono">{r.ip || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

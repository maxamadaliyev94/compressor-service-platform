'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function NewTaskPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [equipment, setEquipment] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [form, setForm] = useState({
    equipmentId: '',
    assignedToId: '',
    type: 'PLANNED_MAINTENANCE',
    priority: 'MEDIUM',
    scheduledAt: '',
    comment: '',
  })

  useEffect(() => {
    fetch('/api/equipment')
      .then((r) => r.json())
      .then(setEquipment)
    fetch('/api/users')
      .then((r) => r.json())
      .then((data) => {
        setUsers(data)
        fetch('/api/auth/session')
          .then((r) => r.json())
          .then((session) => {
            if (session?.user) setCurrentUser(session.user)
          })
      })
  }, [])

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const assignableUsers = users.filter((u) => {
    if (!currentUser) return false
    if (currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER') {
      return ['CHIEF_ENGINEER', 'ENGINEER'].includes(u.role)
    }
    if (currentUser.role === 'CHIEF_ENGINEER') {
      return u.role === 'ENGINEER'
    }
    return false
  })

  const roleLabels: Record<string, string> = {
    CHIEF_ENGINEER: '👷 Главный инженер',
    ENGINEER: '🔧 Инженер',
  }

  const typeLabels: Record<string, string> = {
    PLANNED_MAINTENANCE: 'Плановое ТО',
    DIAGNOSTICS: 'Диагностика',
    WARRANTY_REPAIR: 'Гарантийный ремонт',
    EMERGENCY: 'Аварийный выезд',
    INSTALLATION: 'Монтаж',
    COMMISSIONING: 'Пусконаладка',
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        sendNotification: true,
      }),
    })
    if (res.ok) {
      router.push('/tasks')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <a href="/tasks" className="text-gray-400 hover:text-gray-600">
          ← Назад
        </a>
        <h1 className="text-2xl font-bold">Новая задача</h1>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">Цепочка назначения</h3>
        <div className="flex items-center gap-2 text-sm text-blue-700">
          <span className="bg-blue-200 px-2 py-1 rounded">
            {currentUser?.role === 'ADMIN'
              ? '👑 Администратор'
              : currentUser?.role === 'MANAGER'
                ? '📋 Менеджер'
                : currentUser?.role === 'CHIEF_ENGINEER'
                  ? '👷 Главный инженер'
                  : 'Вы'}
          </span>
          <span>→</span>
          <span className="bg-white border border-blue-200 px-2 py-1 rounded">
            {form.assignedToId
              ? users.find((u) => u.id === form.assignedToId)?.name || 'Выбранный'
              : 'Не назначен'}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border rounded-xl p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1">Оборудование *</label>
          <select
            required
            value={form.equipmentId}
            onChange={(e) => set('equipmentId', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Выберите оборудование</option>
            {equipment.map((eq: any) => (
              <option key={eq.id} value={eq.id}>
                {eq.brand} {eq.model} — {eq.object?.branch?.client?.name} ({eq.serialNumber})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Тип работы *</label>
            <select
              required
              value={form.type}
              onChange={(e) => set('type', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(typeLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Приоритет</label>
            <select
              value={form.priority}
              onChange={(e) => set('priority', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="LOW">⚪ Низкий</option>
              <option value="MEDIUM">🔵 Средний</option>
              <option value="HIGH">🟠 Высокий</option>
              <option value="EMERGENCY">🔴 Аварийный</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Назначить{' '}
            {currentUser?.role === 'CHIEF_ENGINEER' ? 'инженера' : 'ответственного'}
          </label>
          <select
            value={form.assignedToId}
            onChange={(e) => set('assignedToId', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Не назначен</option>
            {assignableUsers.map((u: any) => (
              <option key={u.id} value={u.id}>
                {roleLabels[u.role] || ''} {u.name}
              </option>
            ))}
          </select>
          {form.assignedToId && (
            <p className="text-xs text-green-600 mt-1">✓ Уведомление будет отправлено автоматически</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Срок выполнения</label>
          <input
            type="datetime-local"
            value={form.scheduledAt}
            onChange={(e) => set('scheduledAt', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Описание / комментарий</label>
          <textarea
            value={form.comment}
            onChange={(e) => set('comment', e.target.value)}
            rows={3}
            placeholder="Что нужно сделать, особенности доступа..."
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Создание...' : '✓ Создать и отправить уведомление'}
          </button>
          <a href="/tasks" className="px-6 py-2.5 rounded-lg text-sm border hover:bg-gray-50">
            Отмена
          </a>
        </div>
      </form>
    </div>
  )
}

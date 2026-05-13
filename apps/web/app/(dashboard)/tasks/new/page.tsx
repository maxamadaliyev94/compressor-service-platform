'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function NewTaskPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [equipment, setEquipment] = useState<any[]>([])
  const [equipmentMode, setEquipmentMode] = useState<'list' | 'search'>('list')
  const [equipmentSearch, setEquipmentSearch] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [selectedEngineerIds, setSelectedEngineerIds] = useState<string[]>([])
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
      return u.role === 'CHIEF_ENGINEER'
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

  const normalizedEquipmentQuery = equipmentSearch.trim().toLowerCase()
  const filteredEquipment =
    normalizedEquipmentQuery.length === 0
      ? equipment
      : equipment.filter((eq: any) => {
          const haystack = [
            eq.brand,
            eq.model,
            eq.serialNumber,
            eq.object?.branch?.client?.name,
            eq.object?.name,
            eq.object?.branch?.address,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
          return haystack.includes(normalizedEquipmentQuery)
        })
  const selectedEquipment = equipment.find((eq: any) => eq.id === form.equipmentId)

  const requiresChiefEngineer =
    currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER'
  const chiefEngineerSelected = Boolean(form.assignedToId?.trim())
  const submitBlockedForChief = requiresChiefEngineer && !chiefEngineerSelected

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.equipmentId) {
      alert('Выберите оборудование')
      return
    }
    if (submitBlockedForChief) {
      alert('Выберите главного инженера')
      return
    }
    const chiefAssignsEngineers = currentUser?.role === 'CHIEF_ENGINEER' && selectedEngineerIds.length > 0
    if (chiefAssignsEngineers && !form.scheduledAt) {
      alert('Сначала укажите срок выполнения, затем назначайте инженеров')
      return
    }
    setLoading(true)
    try {
      const payload =
        currentUser?.role === 'CHIEF_ENGINEER'
          ? {
              ...form,
              assignedToId: selectedEngineerIds[0] || '',
              assignedToIds: selectedEngineerIds,
              sendNotification: true,
            }
          : {
              ...form,
              sendNotification: true,
            }

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        router.push('/tasks')
        router.refresh()
        return
      }
      const data = await res.json().catch(() => ({}))
      alert(data?.error || 'Не удалось создать задачу')
    } catch {
      alert('Ошибка сети. Проверьте соединение и попробуйте снова.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="flex items-center gap-2 md:gap-3 mb-6">
        <a href="/tasks" className="text-gray-400 hover:text-gray-600">
          ← Назад
        </a>
        <h1 className="text-2xl font-bold">Новая задача</h1>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">Цепочка назначения</h3>
        {(currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER') && (
          <p className="text-xs text-blue-800/90 mb-2 leading-snug">
            Формат работы (быстрая или долгосрочная) выбирает главный инженер на странице задачи после получения заявки.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 text-sm text-blue-700">
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
            {currentUser?.role === 'CHIEF_ENGINEER'
              ? selectedEngineerIds.length > 0
                ? `Инженеров: ${selectedEngineerIds.length}`
                : 'Не назначен'
              : form.assignedToId
                ? users.find((u) => u.id === form.assignedToId)?.name || 'Выбранный'
                : 'Не назначен'}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border rounded-xl p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1">Оборудование *</label>
          <div className="flex items-center gap-4 mb-2">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="equipment-mode"
                checked={equipmentMode === 'list'}
                onChange={() => setEquipmentMode('list')}
                className="accent-blue-600"
              />
              Из списка
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="equipment-mode"
                checked={equipmentMode === 'search'}
                onChange={() => setEquipmentMode('search')}
                className="accent-blue-600"
              />
              Поиск
            </label>
          </div>
          {equipmentMode === 'list' ? (
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
          ) : (
            <div className="space-y-2">
              <input
                value={equipmentSearch}
                onChange={(e) => setEquipmentSearch(e.target.value)}
                placeholder="Поиск: бренд, модель, серийный номер, клиент..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="max-h-44 overflow-y-auto border rounded-lg divide-y">
                {filteredEquipment.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-400">Ничего не найдено</div>
                ) : (
                  filteredEquipment.map((eq: any) => (
                    <button
                      key={eq.id}
                      type="button"
                      onClick={() => set('equipmentId', eq.id)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                        form.equipmentId === eq.id ? 'bg-blue-50 text-blue-700' : ''
                      }`}
                    >
                      {eq.brand} {eq.model} — {eq.object?.branch?.client?.name} ({eq.serialNumber})
                    </button>
                  ))
                )}
              </div>
              {selectedEquipment ? (
                <div className="text-xs text-green-600">
                  ✓ Выбрано: {selectedEquipment.brand} {selectedEquipment.model} ({selectedEquipment.serialNumber})
                </div>
              ) : (
                <div className="text-xs text-red-500">Выберите оборудование</div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            {currentUser?.role === 'CHIEF_ENGINEER'
              ? 'Назначить инженера'
              : requiresChiefEngineer
                ? 'Главный инженер *'
                : 'Назначить ответственного'}
          </label>
          {currentUser?.role === 'CHIEF_ENGINEER' ? (
            <div className="border rounded-lg p-3 space-y-2 max-h-44 overflow-y-auto">
              {assignableUsers.length === 0 && (
                <p className="text-xs text-gray-500">Нет доступных инженеров</p>
              )}
              {assignableUsers.map((u: any) => (
                <label key={u.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedEngineerIds.includes(u.id)}
                    onChange={(e) => {
                      setSelectedEngineerIds((prev) =>
                        e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)
                      )
                    }}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <span>{roleLabels[u.role] || ''} {u.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <select
              required={requiresChiefEngineer}
              value={form.assignedToId}
              onChange={(e) => set('assignedToId', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">
                {requiresChiefEngineer ? 'Выберите главного инженера' : 'Не назначен'}
              </option>
              {assignableUsers.map((u: any) => (
                <option key={u.id} value={u.id}>
                  {roleLabels[u.role] || ''} {u.name}
                </option>
              ))}
            </select>
          )}
          {currentUser?.role === 'CHIEF_ENGINEER' && selectedEngineerIds.length > 0 && !form.scheduledAt && (
            <p className="text-xs text-amber-700 mt-1">Для назначения инженеров укажите срок выполнения</p>
          )}
          {(form.assignedToId || selectedEngineerIds.length > 0) && (
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
            disabled={loading || submitBlockedForChief}
            title={submitBlockedForChief ? 'Выберите главного инженера' : undefined}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none"
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

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type TaskPayload = {
  id: string
  requestNumber: number
  equipmentId: string
  type: string
  priority: string
  scheduledAt: string | null
  startDate: string | null
  endDate: string | null
  taskType: 'QUICK' | 'LONG_TERM'
  comment: string | null
  assignedToId: string | null
  managedByChiefId: string | null
  assignedTo: { id: string; name: string; role: string } | null
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toDateInput(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

export default function EditActiveTaskClient({ task }: { task: TaskPayload }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [equipment, setEquipment] = useState<any[]>([])
  const [equipmentMode, setEquipmentMode] = useState<'list' | 'search'>('list')
  const [equipmentSearch, setEquipmentSearch] = useState('')
  const [workTypes, setWorkTypes] = useState<{ code: string; nameRu: string }[]>([])

  const initialChiefId =
    task.assignedTo?.role === 'CHIEF_ENGINEER'
      ? task.assignedToId ?? ''
      : task.managedByChiefId ?? task.assignedToId ?? ''

  const [form, setForm] = useState({
    equipmentId: task.equipmentId,
    assignedToId: initialChiefId,
    type: task.type,
    priority: task.priority,
    scheduledAt: toDatetimeLocal(task.scheduledAt),
    startDate: toDateInput(task.startDate),
    endDate: toDateInput(task.endDate),
    comment: task.comment ?? '',
  })

  useEffect(() => {
    fetch('/api/work-types')
      .then((r) => (r.ok ? r.json() : []))
      .then((list: { code: string; nameRu: string }[]) => {
        if (Array.isArray(list)) setWorkTypes(list)
      })
    fetch('/api/equipment')
      .then((r) => r.json())
      .then(setEquipment)
    fetch('/api/users')
      .then((r) => r.json())
      .then(setUsers)
  }, [])

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const chiefs = users.filter((u) => u.role === 'CHIEF_ENGINEER' && u.isActive !== false)

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
            eq.object?.branch?.name,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
          return haystack.includes(normalizedEquipmentQuery)
        })

  const selectedEquipment = equipment.find((eq: any) => eq.id === form.equipmentId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.equipmentId) {
      alert('Выберите оборудование')
      return
    }
    if (!form.assignedToId) {
      alert('Выберите главного инженера')
      return
    }

    setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        equipmentId: form.equipmentId,
        type: form.type,
        priority: form.priority,
        comment: form.comment.trim() || null,
        assignedToId: form.assignedToId,
      }

      if (task.taskType === 'LONG_TERM') {
        payload.startDate = form.startDate || null
        payload.endDate = form.endDate || null
      } else {
        payload.scheduledAt =
          form.scheduledAt && form.scheduledAt.length > 0
            ? new Date(form.scheduledAt).toISOString()
            : null
      }

      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert((data as { error?: string }).error || 'Не удалось сохранить')
        return
      }
      router.push(`/tasks/${task.id}`)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
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
              {filteredEquipment.map((eq: any) => (
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
              ))}
            </div>
            {selectedEquipment && (
              <div className="text-xs text-green-600">
                ✓ Выбрано: {selectedEquipment.brand} {selectedEquipment.model}
              </div>
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
            className="w-full border rounded-lg px-3 py-2 text-sm"
          >
            {workTypes.map((wt) => (
              <option key={wt.code} value={wt.code}>
                {wt.nameRu}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Приоритет</label>
          <select
            value={form.priority}
            onChange={(e) => set('priority', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          >
            <option value="LOW">⚪ Низкий</option>
            <option value="MEDIUM">🔵 Средний</option>
            <option value="HIGH">🟠 Высокий</option>
            <option value="EMERGENCY">🔴 Аварийный</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Главный инженер *</label>
        <select
          required
          value={form.assignedToId}
          onChange={(e) => set('assignedToId', e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Выберите главного инженера</option>
          {chiefs.map((u: any) => (
            <option key={u.id} value={u.id}>
              👷 {u.name}
            </option>
          ))}
        </select>
      </div>

      {task.taskType === 'LONG_TERM' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Дата начала</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => set('startDate', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Дата окончания</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => set('endDate', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium mb-1">Срок выполнения</label>
          <input
            type="datetime-local"
            value={form.scheduledAt}
            onChange={(e) => set('scheduledAt', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Описание / комментарий</label>
        <textarea
          value={form.comment}
          onChange={(e) => set('comment', e.target.value)}
          rows={3}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Сохранение…' : '✓ Сохранить изменения'}
        </button>
        <a href={`/tasks/${task.id}`} className="px-6 py-2.5 rounded-lg text-sm border hover:bg-gray-50">
          Отмена
        </a>
      </div>
    </form>
  )
}

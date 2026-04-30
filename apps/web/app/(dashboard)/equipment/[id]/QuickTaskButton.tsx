'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  equipmentId: string
  createdById: string
}

const typeLabels: Record<string, string> = {
  PLANNED_MAINTENANCE: 'Плановое ТО',
  DIAGNOSTICS: 'Диагностика',
  WARRANTY_REPAIR: 'Гарантийный ремонт',
  EMERGENCY: 'Аварийный выезд',
  INSTALLATION: 'Монтаж',
  COMMISSIONING: 'Пусконаладка',
}

export default function QuickTaskButton({ equipmentId, createdById }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [regulations, setRegulations] = useState<any[]>([])
  const [engineers, setEngineers] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [form, setForm] = useState({
    type: 'PLANNED_MAINTENANCE',
    priority: 'MEDIUM',
    assignedToId: '',
    scheduledAt: '',
    comment: '',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    fetch('/api/regulations').then(r => r.json()).then(setRegulations)
    fetch('/api/users').then(r => r.json()).then(data =>
      setEngineers(data.filter((u: any) => ['ENGINEER', 'CHIEF_ENGINEER'].includes(u.role)))
    )
  }, [open])

  function selectRegulation(reg: any) {
    setSelected(reg)
    setForm(prev => ({ ...prev, type: reg.taskType }))
  }

  async function create() {
    setLoading(true)
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        equipmentId,
        createdById,
        type: form.type,
        priority: form.priority,
        assignedToId: form.assignedToId || null,
        scheduledAt: form.scheduledAt || null,
        comment: form.comment || null,
        regulationId: selected?.id || null,
      })
    })
    setLoading(false)
    if (res.ok) {
      setOpen(false)
      router.refresh()
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-blue-700">
        + Создать задачу
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-5 border-b">
              <h2 className="text-lg font-bold">Создать задачу</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Тип работы / Регламент
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(typeLabels).map(([type, label]) => {
                    const reg = regulations.find(r => r.taskType === type)
                    const isSelected = form.type === type
                    return (
                      <button key={type} type="button"
                        onClick={() => {
                          setForm(prev => ({ ...prev, type }))
                          if (reg) selectRegulation(reg)
                          else setSelected(null)
                        }}
                        className={`text-left p-3 rounded-xl border-2 transition-colors ${
                          isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                        }`}>
                        <div className="text-sm font-semibold">{label}</div>
                        {reg && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            📋 {reg.items.length} пунктов чек-листа
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {selected && selected.items?.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="text-sm font-medium text-green-800 mb-2">
                    ✓ Чек-лист: {selected.name}
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {selected.items.slice(0, 5).map((item: any, i: number) => (
                      <div key={item.id} className="text-xs text-green-700 flex gap-1">
                        <span>{i + 1}.</span>
                        <span>{item.label}</span>
                      </div>
                    ))}
                    {selected.items.length > 5 && (
                      <div className="text-xs text-green-500">
                        ... и ещё {selected.items.length - 5} пунктов
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Приоритет</label>
                  <select value={form.priority}
                    onChange={e => setForm(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="LOW">Низкий</option>
                    <option value="MEDIUM">Средний</option>
                    <option value="HIGH">Высокий</option>
                    <option value="EMERGENCY">Аварийный</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Срок выполнения</label>
                  <input type="date" value={form.scheduledAt}
                    onChange={e => setForm(prev => ({ ...prev, scheduledAt: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Назначить инженера</label>
                <select value={form.assignedToId}
                  onChange={e => setForm(prev => ({ ...prev, assignedToId: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Не назначен</option>
                  {engineers.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Комментарий</label>
                <textarea value={form.comment}
                  onChange={e => setForm(prev => ({ ...prev, comment: e.target.value }))}
                  rows={2}
                  placeholder="Описание задачи, жалобы клиента..."
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t">
              <button onClick={create} disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {loading ? 'Создание...' : '✓ Создать задачу'}
              </button>
              <button onClick={() => setOpen(false)}
                className="flex-1 border py-2.5 rounded-lg text-sm hover:bg-gray-50">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

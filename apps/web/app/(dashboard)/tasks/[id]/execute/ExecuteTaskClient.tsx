'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type {
  User,
  ServiceTask,
  Equipment,
  Object as ObjectModel,
  Branch,
  Client as ClientModel,
  MaintenanceRegulation,
  MaintenanceRegulationItem,
} from '@prisma/client'

type TaskWithRelations = ServiceTask & {
  equipment: Equipment & {
    object: ObjectModel & { branch: Branch & { client: ClientModel } }
  }
  assignedTo: User | null
  createdBy: User
}

type RegulationWithItems = (MaintenanceRegulation & { items: MaintenanceRegulationItem[] }) | null

interface ChecklistItem {
  id: string
  label: string
  checked: boolean
  isRequired: boolean
}

interface Props {
  task: TaskWithRelations
  regulation: RegulationWithItems
  engineerId: string
  engineerName: string
}

export default function ExecuteTaskClient({ task, regulation, engineerId, engineerName }: Props) {
  const router = useRouter()
  const eq = task.equipment
  const client = eq.object.branch.client

  const [step, setStep] = useState<'start' | 'checklist' | 'hours' | 'parts' | 'notes' | 'complete'>('start')
  const [loading, setLoading] = useState(false)

  const [currentHours, setCurrentHours] = useState(String(eq.currentHours))
  const [nextServiceHours, setNextServiceHours] = useState(
    String(eq.nextServiceHours ?? eq.currentHours + 2000)
  )
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    regulation?.items?.map((item) => ({
      id: item.id,
      label: item.label,
      checked: false,
      isRequired: item.isRequired,
    })) ?? []
  )
  const [parts, setParts] = useState<{ name: string; quantity: number; unit: string }[]>([])
  const [newPartName, setNewPartName] = useState('')
  const [newPartQty, setNewPartQty] = useState('1')
  const [newPartUnit, setNewPartUnit] = useState('шт')
  const [notes, setNotes] = useState('')
  const [recommendations, setRecommendations] = useState('')

  const checkedCount = checklist.filter((i) => i.checked).length
  const requiredCount = checklist.filter((i) => i.isRequired).length
  const checkedRequired = checklist.filter((i) => i.isRequired && i.checked).length

  function toggleChecklist(id: string) {
    setChecklist((prev) => prev.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)))
  }

  function addPart() {
    if (!newPartName.trim()) return
    setParts((prev) => [
      ...prev,
      { name: newPartName.trim(), quantity: parseFloat(newPartQty) || 1, unit: newPartUnit },
    ])
    setNewPartName('')
    setNewPartQty('1')
  }

  async function startTask() {
    setLoading(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'IN_PROGRESS' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert((err as { error?: string }).error ?? 'Не удалось обновить статус')
        return
      }
      setStep('checklist')
    } finally {
      setLoading(false)
    }
  }

  async function completeTask() {
    if (!currentHours) {
      alert('Введите текущие моточасы')
      return
    }
    if (!nextServiceHours) {
      alert('Введите следующее ТО')
      return
    }
    const uncheckedRequired = checklist.filter((i) => i.isRequired && !i.checked)
    if (uncheckedRequired.length > 0) {
      const ok = confirm(
        `Не выполнено ${uncheckedRequired.length} обязательных пунктов чек-листа. Продолжить?`
      )
      if (!ok) {
        setStep('checklist')
        return
      }
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentHours: parseInt(currentHours, 10),
          nextServiceHours: parseInt(nextServiceHours, 10),
          checklist: checklist.map((i) => ({ label: i.label, checked: i.checked })),
          partsUsed: parts,
          notes,
          recommendations,
          engineerId,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert((err as { error?: string }).error ?? 'Не удалось завершить задачу')
        return
      }
      router.push(`/tasks/${task.id}`)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const typeLabels: Record<string, string> = {
    PLANNED_MAINTENANCE: 'Плановое ТО',
    DIAGNOSTICS: 'Диагностика',
    WARRANTY_REPAIR: 'Гарантийный ремонт',
    EMERGENCY: 'Аварийный выезд',
    INSTALLATION: 'Монтаж',
    COMMISSIONING: 'Пусконаладка',
  }

  const steps = ['start', 'checklist', 'hours', 'parts', 'notes', 'complete']
  const stepIdx = steps.indexOf(step)

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-2 mb-6 text-sm text-gray-500">
        <a href="/tasks" className="hover:text-gray-700">
          ← Задачи
        </a>
        <span>/</span>
        <span className="text-gray-900 font-medium">{typeLabels[task.type]}</span>
      </div>

      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { key: 'start', label: 'Старт' },
          { key: 'checklist', label: 'Чек-лист' },
          { key: 'hours', label: 'Моточасы' },
          { key: 'parts', label: 'Запчасти' },
          { key: 'notes', label: 'Заметки' },
          { key: 'complete', label: 'Завершить' },
        ].map((s, i) => (
          <div key={s.key} className="flex items-center gap-2 flex-shrink-0">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                step === s.key
                  ? 'bg-blue-600 text-white'
                  : steps.indexOf(s.key) < stepIdx
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
              }`}
            >
              {steps.indexOf(s.key) < stepIdx ? '✓' : i + 1}. {s.label}
            </div>
            {i < 5 && <span className="text-gray-300">→</span>}
          </div>
        ))}
      </div>

      <div className="bg-white border rounded-xl p-4 mb-5">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold">{typeLabels[task.type]}</h1>
            <p className="text-gray-500 text-sm">
              {eq.brand} {eq.model} · {client.name}
            </p>
            {regulation && (
              <p className="text-xs text-blue-600 mt-1">📋 Регламент: {regulation.name}</p>
            )}
          </div>
          <div className="text-right text-sm">
            <div className="text-gray-500">Инженер:</div>
            <div className="font-medium">{engineerName}</div>
          </div>
        </div>
      </div>

      {step === 'start' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-5">
            <h2 className="font-semibold mb-4">Информация перед началом</h2>
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <span className="text-gray-500">Клиент:</span> <strong>{client.name}</strong>
              </div>
              <div>
                <span className="text-gray-500">Объект:</span> {eq.object.name}
              </div>
              <div>
                <span className="text-gray-500">Адрес:</span>{' '}
                {eq.object.branch.address || eq.object.branch.name}
              </div>
              <div>
                <span className="text-gray-500">Телефон:</span>{' '}
                {client.phone ? (
                  <a href={`tel:${client.phone}`} className="text-blue-600">
                    {client.phone}
                  </a>
                ) : (
                  '—'
                )}
              </div>
              <div>
                <span className="text-gray-500">Оборудование:</span>{' '}
                <strong>
                  {eq.brand} {eq.model}
                </strong>
              </div>
              <div>
                <span className="text-gray-500">Серийный №:</span> {eq.serialNumber}
              </div>
              <div>
                <span className="text-gray-500">Моточасы:</span> <strong>{eq.currentHours} м/ч</strong>
              </div>
              <div>
                <span className="text-gray-500">След. ТО:</span> {eq.nextServiceHours ?? '—'} м/ч
              </div>
            </div>
            {task.comment && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                <strong>Комментарий диспетчера:</strong> {task.comment}
              </div>
            )}
          </div>
          {regulation && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="font-semibold text-blue-800 mb-2">📋 {regulation.name}</h3>
              <p className="text-xs text-blue-600 mb-2">
                Будет выполнено {regulation.items.length} пунктов
              </p>
              <div className="grid grid-cols-2 gap-1">
                {regulation.items.slice(0, 6).map((item, i) => (
                  <div key={item.id} className="text-xs text-blue-700 flex gap-1">
                    <span>{i + 1}.</span>
                    <span className="truncate">{item.label}</span>
                  </div>
                ))}
                {regulation.items.length > 6 && (
                  <div className="text-xs text-blue-500 col-span-2">
                    ... и ещё {regulation.items.length - 6} пунктов
                  </div>
                )}
              </div>
            </div>
          )}
          <button
            onClick={startTask}
            disabled={loading}
            className="w-full bg-green-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Запуск...' : '▶ Приступить к работе'}
          </button>
        </div>
      )}

      {step === 'checklist' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between">
              <h2 className="font-semibold">Чек-лист работ</h2>
              <span className="text-sm text-gray-500">
                {checkedCount} / {checklist.length}
              </span>
            </div>
            <div className="w-full bg-gray-100 h-2">
              <div
                className="bg-blue-500 h-2 transition-all"
                style={{
                  width: `${checklist.length ? (checkedCount / checklist.length) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="divide-y">
              {checklist.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => toggleChecklist(item.id)}
                    className="w-5 h-5 rounded accent-blue-600"
                  />
                  <span
                    className={`text-sm flex-1 ${item.checked ? 'line-through text-gray-400' : 'text-gray-700'}`}
                  >
                    {item.label}
                  </span>
                  {item.isRequired && !item.checked && (
                    <span className="text-xs text-red-400 flex-shrink-0">обяз.</span>
                  )}
                  {item.checked && <span className="text-green-500 text-sm flex-shrink-0">✓</span>}
                </label>
              ))}
              {checklist.length === 0 && (
                <div className="p-6 text-center text-gray-400 text-sm">
                  Чек-лист не назначен — вы можете перейти дальше
                </div>
              )}
            </div>
          </div>
          {checkedRequired < requiredCount && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
              ⚠️ Не выполнено {requiredCount - checkedRequired} обязательных пунктов
            </div>
          )}
          <button
            onClick={() => setStep('hours')}
            className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700"
          >
            Далее → Моточасы
          </button>
        </div>
      )}

      {step === 'hours' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold">Моточасы</h2>
            <div>
              <label className="block text-sm font-medium mb-1">Текущие моточасы *</label>
              <input
                type="number"
                value={currentHours}
                onChange={(e) => setCurrentHours(e.target.value)}
                className="w-full border-2 border-blue-500 rounded-xl px-4 py-3 text-2xl font-bold text-center focus:outline-none"
                min={0}
              />
              <p className="text-xs text-gray-400 mt-1 text-center">
                Значение до работы: {eq.currentHours} м/ч
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Следующее ТО (моточасы) *</label>
              <input
                type="number"
                value={nextServiceHours}
                onChange={(e) => setNextServiceHours(e.target.value)}
                className="w-full border-2 border-green-500 rounded-xl px-4 py-3 text-2xl font-bold text-center focus:outline-none"
                min={0}
              />
              <p className="text-xs text-gray-400 mt-1 text-center">
                Рекомендуется: {parseInt(currentHours || '0', 10) + 2000} м/ч (+2000)
              </p>
            </div>
            {currentHours && nextServiceHours && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center text-sm text-green-700 font-medium">
                До следующего ТО: {parseInt(nextServiceHours, 10) - parseInt(currentHours, 10)} м/ч
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep('checklist')}
              className="flex-1 border py-3 rounded-xl text-sm hover:bg-gray-50"
            >
              ← Назад
            </button>
            <button
              onClick={() => setStep('parts')}
              disabled={!currentHours || !nextServiceHours}
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              Далее → Запчасти
            </button>
          </div>
        </div>
      )}

      {step === 'parts' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="font-semibold">Использованные запчасти и расходники</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Необязательно — оставьте пустым если не использовались
              </p>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <input
                  value={newPartName}
                  onChange={(e) => setNewPartName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addPart()}
                  placeholder="Название (масло, фильтр, ремень...)"
                  className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  value={newPartQty}
                  onChange={(e) => setNewPartQty(e.target.value)}
                  className="w-16 border rounded-lg px-2 py-2 text-sm focus:outline-none text-center"
                />
                <select
                  value={newPartUnit}
                  onChange={(e) => setNewPartUnit(e.target.value)}
                  className="border rounded-lg px-2 py-2 text-sm focus:outline-none"
                >
                  <option>шт</option>
                  <option>л</option>
                  <option>кг</option>
                  <option>компл</option>
                </select>
                <button
                  onClick={addPart}
                  disabled={!newPartName.trim()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  +
                </button>
              </div>
              {parts.length > 0 && (
                <div className="space-y-2">
                  {parts.map((p, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-sm font-medium">{p.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">
                          {p.quantity} {p.unit}
                        </span>
                        <button
                          type="button"
                          onClick={() => setParts((prev) => prev.filter((_, j) => j !== i))}
                          className="text-red-400 hover:text-red-600 text-sm"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {parts.length === 0 && (
                <div className="text-center text-gray-400 text-sm py-4">Запчасти не добавлены</div>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep('hours')}
              className="flex-1 border py-3 rounded-xl text-sm hover:bg-gray-50"
            >
              ← Назад
            </button>
            <button
              onClick={() => setStep('notes')}
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700"
            >
              Далее → Заметки
            </button>
          </div>
        </div>
      )}

      {step === 'notes' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold">Заметки и рекомендации</h2>
            <div>
              <label className="block text-sm font-medium mb-1">Комментарий инженера</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Что было сделано, что обнаружили..."
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Рекомендации клиенту</label>
              <textarea
                value={recommendations}
                onChange={(e) => setRecommendations(e.target.value)}
                rows={3}
                placeholder="Что нужно сделать клиенту, на что обратить внимание..."
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep('parts')}
              className="flex-1 border py-3 rounded-xl text-sm hover:bg-gray-50"
            >
              ← Назад
            </button>
            <button
              onClick={() => setStep('complete')}
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700"
            >
              Далее → Завершить
            </button>
          </div>
        </div>
      )}

      {step === 'complete' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-5">
            <h2 className="font-semibold mb-4">✅ Сводка перед закрытием</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-gray-500">Тип работы</span>
                <span className="text-sm font-medium">{typeLabels[task.type]}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-gray-500">Чек-лист</span>
                <span
                  className={`text-sm font-medium ${checkedCount === checklist.length ? 'text-green-600' : 'text-yellow-600'}`}
                >
                  {checkedCount} / {checklist.length} пунктов
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-gray-500">Моточасы</span>
                <span className="text-sm font-medium">{currentHours} м/ч</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-gray-500">Следующее ТО</span>
                <span className="text-sm font-medium text-green-600">{nextServiceHours} м/ч</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-gray-500">Запчасти</span>
                <span className="text-sm font-medium">{parts.length} позиций</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-500">Инженер</span>
                <span className="text-sm font-medium">{engineerName}</span>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
            После завершения будет автоматически сформирован PDF-акт выполненных работ
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('notes')}
              className="flex-1 border py-3 rounded-xl text-sm hover:bg-gray-50"
            >
              ← Назад
            </button>
            <button
              onClick={completeTask}
              disabled={loading}
              className="flex-1 bg-green-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Закрытие задачи...' : '✅ Завершить и сформировать акт'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { webAuthnUserVisibleError } from '@/lib/webauthn-client-error'
import { getWebAuthnUnsupportedReason } from '@/lib/webauthn-support'
import { startAuthentication } from '@simplewebauthn/browser'
import { useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import ActSignaturePad from './ActSignaturePad'
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
  category: string
  label: string
  checked: boolean
  isRequired: boolean
  isAuto?: boolean
}

interface Props {
  task: TaskWithRelations
  regulation: RegulationWithItems
  engineerId: string
  engineerName: string
  /** PNG data URL из «Настройка аккаунта» */
  savedActSignature: string | null
  hasWebAuthnForSign: boolean
}

type ChecklistTemplateGroup = {
  category: string
  items: string[]
}

const CHECKLIST_TEMPLATE_GROUPS: ChecklistTemplateGroup[] = [
  {
    category: 'Тип работ (авто)',
    items: ['Плановое ТО', 'Диагностика', 'Ремонт', 'Гарантийный ремонт', 'Монтаж', 'Пусконаладка'],
  },
  {
    category: 'Масляная система',
    items: [
      'Замена масла',
      'Долив масла',
      'Замена масляного фильтра',
      'Замена сепаратора',
      'Устранение утечки масла',
    ],
  },
  {
    category: 'Воздушная система (впуск)',
    items: [
      'Замена воздушного фильтра',
      'Очистка воздушного фильтра',
      'Замена панельного фильтра',
      'Очистка панельного фильтра',
      'Ремкомплект впускного клапана',
      'Замена впускного клапана',
      'Устранение утечки воздуха',
    ],
  },
  {
    category: 'Клапанная группа',
    items: [
      'Замена клапана минимального давления',
      'Ремкомплект клапана минимального давления',
      'Замена обратного клапана',
      'Ремонт обратного клапана',
      'Замена регулятора давления',
      'Замена реле давления',
    ],
  },
  {
    category: 'Система охлаждения',
    items: ['Очистка радиатора', 'Продувка радиатора', 'Замена радиатора', 'Ремонт системы охлаждения'],
  },
  {
    category: 'Винтовой блок',
    items: [
      'Проверка состояния',
      'Замена подшипников винтового блока',
      'Замена сальников винтового блока',
      'Капитальный ремонт винтового блока',
    ],
  },
  {
    category: 'Привод (ремни / муфта)',
    items: ['Проверка ремней', 'Замена ремней', 'Натяжка ремней', 'Проверка муфты', 'Замена муфты', 'Центровка'],
  },
  {
    category: 'Электродвигатель',
    items: [
      'Проверка состояния',
      'Смазка электродвигателя',
      'Замена подшипников электродвигателя',
      'Ремонт электродвигателя',
    ],
  },
  {
    category: 'Электрика и управление',
    items: [
      'Проверка питания',
      'Протяжка клемм',
      'Замена контакторов / реле',
      'Замена контроллера',
      'Настройка контроллера',
      'Замена датчика давления',
      'Замена датчика температуры',
      'Проверка контроллера',
      'Устранение ошибок',
    ],
  },
  {
    category: 'КИП (датчики)',
    items: ['Проверка датчиков', 'Калибровка датчиков'],
  },
  {
    category: 'Пневмосистема',
    items: ['Замена полиамидной трубки', 'Замена фитингов', 'Устранение утечек'],
  },
  {
    category: 'Дополнительно',
    items: ['Установка ремкомплекта (указать узел)', 'Сброс сервисного счетчика'],
  },
  {
    category: 'Завершение',
    items: ['Запуск оборудования', 'Проверка под нагрузкой', 'Оборудование работает стабильно'],
  },
]

const AUTO_TYPE_LABELS: Record<string, string> = {
  PLANNED_MAINTENANCE: 'Плановое ТО',
  DIAGNOSTICS: 'Диагностика',
  WARRANTY_REPAIR: 'Гарантийный ремонт',
  EMERGENCY: 'Ремонт',
  INSTALLATION: 'Монтаж',
  COMMISSIONING: 'Пусконаладка',
}

function buildFallbackChecklist(taskType: string): ChecklistItem[] {
  const activeTypeLabel = AUTO_TYPE_LABELS[taskType] ?? 'Плановое ТО'
  let idx = 0

  return CHECKLIST_TEMPLATE_GROUPS.flatMap((group) =>
    group.items.map((label) => {
      const isTypeGroup = group.category === 'Тип работ (авто)'
      const isAuto = isTypeGroup
      const checked = isTypeGroup && label === activeTypeLabel
      const isRequired = false
      idx += 1
      return {
        id: `tpl-${idx}`,
        category: group.category,
        label,
        checked,
        isRequired,
        isAuto,
      }
    })
  )
}

export default function ExecuteTaskClient({
  task,
  regulation,
  engineerId,
  engineerName,
  savedActSignature,
  hasWebAuthnForSign,
}: Props) {
  const router = useRouter()
  const eq = task.equipment
  const client = eq.object.branch.client

  const [step, setStep] = useState<'start' | 'checklist' | 'hours' | 'parts' | 'notes' | 'complete'>('start')
  const [loading, setLoading] = useState(false)

  const [currentHours, setCurrentHours] = useState(String(eq.currentHours))
  const [nextServiceHours, setNextServiceHours] = useState(
    String(eq.nextServiceHours ?? eq.currentHours + 2000)
  )
  const [loadHours, setLoadHours] = useState('')
  const [voltageL1, setVoltageL1] = useState('')
  const [voltageL2, setVoltageL2] = useState('')
  const [voltageL3, setVoltageL3] = useState('')
  const [currentL1, setCurrentL1] = useState('')
  const [currentL2, setCurrentL2] = useState('')
  const [currentL3, setCurrentL3] = useState('')
  const [ambientTemp, setAmbientTemp] = useState('')
  const [oilTemp, setOilTemp] = useState('')
  const [pressureUpper, setPressureUpper] = useState('')
  const [pressureLower, setPressureLower] = useState('')
  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => {
    const regulationItems =
      regulation?.items?.map((item) => ({
        id: item.id,
        category: regulation?.name ?? 'Регламент',
        label: item.label,
        checked: false,
        isRequired: false,
      })) ?? []

    if (regulationItems.length > 0) return regulationItems
    return buildFallbackChecklist(task.type)
  })
  const [parts, setParts] = useState<{ name: string; quantity: number; unit: string }[]>([])
  const [newPartName, setNewPartName] = useState('')
  const [newPartQty, setNewPartQty] = useState('1')
  const [newPartUnit, setNewPartUnit] = useState('шт')
  const [notes, setNotes] = useState('')
  const [recommendations, setRecommendations] = useState('')
  const [reportPhotos, setReportPhotos] = useState<string[]>([])
  const [engineerSignature, setEngineerSignature] = useState<string | null>(null)
  const [engineerSignedAt, setEngineerSignedAt] = useState<Date | null>(null)
  const [faceSignMsg, setFaceSignMsg] = useState('')
  const [faceSignLoading, setFaceSignLoading] = useState(false)

  const checkedCount = checklist.filter((i) => i.checked).length

  function applySavedTemplateSignature() {
    if (!savedActSignature) return
    setFaceSignMsg('')
    setEngineerSignature(savedActSignature)
    setEngineerSignedAt(new Date())
  }

  async function applySignatureWithFaceId() {
    setFaceSignMsg('')
    const unsupported = getWebAuthnUnsupportedReason()
    if (unsupported) {
      setFaceSignMsg(unsupported)
      return
    }
    if (!savedActSignature) {
      setFaceSignMsg('Сначала сохраните шаблон подписи в «Настройка аккаунта».')
      return
    }
    if (!hasWebAuthnForSign) {
      setFaceSignMsg('Сначала настройте Face ID в «Настройка аккаунта».')
      return
    }
    setFaceSignLoading(true)
    try {
      const optRes = await fetch('/api/webauthn/sign/options', { method: 'POST' })
      if (optRes.status === 404) {
        setFaceSignMsg('Face ID не настроен')
        return
      }
      if (!optRes.ok) {
        setFaceSignMsg('Не удалось начать подтверждение')
        return
      }
      const { options, challengeToken } = (await optRes.json()) as {
        options: Parameters<typeof startAuthentication>[0]['optionsJSON']
        challengeToken: string
      }
      const assertion = await startAuthentication({ optionsJSON: options })
      const verifyRes = await fetch('/api/webauthn/sign/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: assertion, challengeToken }),
      })
      if (!verifyRes.ok) {
        setFaceSignMsg('Биометрия не подтверждена')
        return
      }
      applySavedTemplateSignature()
    } catch (e) {
      setFaceSignMsg(webAuthnUserVisibleError(e))
    } finally {
      setFaceSignLoading(false)
    }
  }

  function toggleChecklist(id: string) {
    setChecklist((prev) =>
      prev.map((i) => {
        if (i.id !== id || i.isAuto) return i
        return { ...i, checked: !i.checked }
      })
    )
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

  function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function onPickReportPhotos(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const allowed = Math.max(0, 10 - reportPhotos.length)
    const selected = files.slice(0, allowed)
    const loaded = await Promise.all(selected.map(readFileAsDataUrl))
    setReportPhotos((prev) => [...prev, ...loaded].slice(0, 10))
    e.target.value = ''
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
    if (!engineerSignature || !engineerSignedAt) {
      alert('Нужна подпись инженера на вкладке «Завершить»')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentHours: parseInt(currentHours, 10),
          nextServiceHours: parseInt(nextServiceHours, 10),
          loadHours: loadHours ? Number(loadHours) : null,
          voltageL1: voltageL1 ? Number(voltageL1) : null,
          voltageL2: voltageL2 ? Number(voltageL2) : null,
          voltageL3: voltageL3 ? Number(voltageL3) : null,
          currentL1: currentL1 ? Number(currentL1) : null,
          currentL2: currentL2 ? Number(currentL2) : null,
          currentL3: currentL3 ? Number(currentL3) : null,
          ambientTemp: ambientTemp ? Number(ambientTemp) : null,
          oilTemp: oilTemp ? Number(oilTemp) : null,
          pressureUpper: pressureUpper ? Number(pressureUpper) : null,
          pressureLower: pressureLower ? Number(pressureLower) : null,
          checklist: checklist.map((i) => ({ label: i.label, checked: i.checked })),
          partsUsed: parts,
          notes,
          recommendations,
          reportPhotos,
          engineerId,
          engineerSignature,
          engineerSignedAt: engineerSignedAt.toISOString(),
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
  const checklistByCategory = checklist.reduce<Record<string, ChecklistItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})

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
          { key: 'hours', label: 'Показатели' },
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
              {Object.entries(checklistByCategory).map(([category, items]) => (
                <div key={category}>
                  <div className="px-4 py-2 bg-gray-50 border-y text-xs font-semibold text-gray-600">
                    {category}
                  </div>
                  {items.map((item) => (
                    <label
                      key={item.id}
                      className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 ${
                        item.isAuto ? 'cursor-not-allowed bg-gray-50/60' : 'cursor-pointer'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        disabled={item.isAuto}
                        onChange={() => toggleChecklist(item.id)}
                        className="w-5 h-5 rounded accent-blue-600 disabled:opacity-60"
                      />
                      <span
                        className={`text-sm flex-1 ${item.checked ? 'line-through text-gray-400' : 'text-gray-700'}`}
                      >
                        {item.label}
                      </span>
                      {item.isAuto && (
                        <span className="text-xs text-blue-500 flex-shrink-0">авто</span>
                      )}
                      {item.checked && <span className="text-green-500 text-sm flex-shrink-0">✓</span>}
                    </label>
                  ))}
                </div>
              ))}
              {checklist.length === 0 && (
                <div className="p-6 text-center text-gray-400 text-sm">
                  Чек-лист не назначен — вы можете перейти дальше
                </div>
              )}
            </div>
          </div>
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
            <h2 className="font-semibold">Показатели</h2>
            <div>
              <label className="block text-sm font-medium mb-1">Моточасы текущие *</label>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Моточасы под нагрузкой</label>
                <input
                  type="number"
                  value={loadHours}
                  onChange={(e) => setLoadHours(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min={0}
                  placeholder="Необязательно"
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3">Электрические параметры (необязательно)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input type="number" value={voltageL1} onChange={(e) => setVoltageL1(e.target.value)} placeholder="Напряжение L1, V" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="number" value={voltageL2} onChange={(e) => setVoltageL2(e.target.value)} placeholder="Напряжение L2, V" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="number" value={voltageL3} onChange={(e) => setVoltageL3(e.target.value)} placeholder="Напряжение L3, V" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="number" value={currentL1} onChange={(e) => setCurrentL1(e.target.value)} placeholder="Ток фаза 1, A" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="number" value={currentL2} onChange={(e) => setCurrentL2(e.target.value)} placeholder="Ток фаза 2, A" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="number" value={currentL3} onChange={(e) => setCurrentL3(e.target.value)} placeholder="Ток фаза 3, A" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3">Температура и давление (необязательно)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input type="number" value={ambientTemp} onChange={(e) => setAmbientTemp(e.target.value)} placeholder="Температура окружающей среды, °C" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="number" value={oilTemp} onChange={(e) => setOilTemp(e.target.value)} placeholder="Температура масла, °C" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="number" value={pressureUpper} onChange={(e) => setPressureUpper(e.target.value)} placeholder="Давление верхнее, бар" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="number" value={pressureLower} onChange={(e) => setPressureLower(e.target.value)} placeholder="Давление нижнее, бар" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
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
            <div>
              <label className="block text-sm font-medium mb-1">Фото отчета (до 10 шт.)</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={onPickReportPhotos}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">Загружено: {reportPhotos.length} / 10</p>
              {reportPhotos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  {reportPhotos.map((src, idx) => (
                    <div key={`${idx}-${src.slice(0, 24)}`} className="relative border rounded-lg overflow-hidden bg-gray-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`Фото отчета ${idx + 1}`} className="w-full h-24 object-cover" />
                      <button
                        type="button"
                        onClick={() => setReportPhotos((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 bg-white/90 text-red-600 border rounded px-1.5 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
          <div className="bg-white border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold">Подпись инженера</h2>
            <p className="text-xs text-gray-500">
              Поставьте подпись перед закрытием задачи. Можно подставить сохранённый шаблон или подтвердить его через Face ID. Подпись клиента можно добавить позже в карточке задачи.
            </p>
            {!engineerSignature && (savedActSignature || hasWebAuthnForSign) && (
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                {savedActSignature && (
                  <button
                    type="button"
                    onClick={applySavedTemplateSignature}
                    className="flex-1 border border-green-600 text-green-800 py-2.5 rounded-lg text-sm font-medium hover:bg-green-50"
                  >
                    Подставить сохранённую подпись
                  </button>
                )}
                {savedActSignature && hasWebAuthnForSign && (
                  <button
                    type="button"
                    onClick={applySignatureWithFaceId}
                    disabled={faceSignLoading}
                    className="flex-1 border border-blue-600 text-blue-800 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-50"
                  >
                    {faceSignLoading ? 'Сканирование…' : 'Подписать через Face ID'}
                  </button>
                )}
              </div>
            )}
            {faceSignMsg && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">{faceSignMsg}</p>}
            <ActSignaturePad
              variant="engineer"
              title="Подпись инженера"
              signedDataUrl={engineerSignature}
              signedAt={engineerSignedAt}
              signerName={engineerName}
              onSigned={(url, at) => {
                setEngineerSignature(url)
                setEngineerSignedAt(at)
              }}
              onReset={() => {
                setEngineerSignature(null)
                setEngineerSignedAt(null)
              }}
            />
          </div>

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

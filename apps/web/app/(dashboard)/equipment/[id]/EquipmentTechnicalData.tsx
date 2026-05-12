'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getWarrantyStatus } from '@csp/shared'

type Initial = {
  type: string
  brand: string
  model: string
  serialNumber: string
  yearOfManufacture: number | null
  installDate: string | null
  warrantyUntil: string | null
  warrantyVoided: boolean
  status: string
  pressureBar: number | null
  currentHours: number
  nextServiceHours: number | null
  notes: string | null
}

const typeLabels: Record<string, string> = {
  COMPRESSOR: 'Компрессор',
  DRYER: 'Осушитель',
  RECEIVER: 'Ресивер',
  FILTER: 'Фильтр',
  NITROGEN_GENERATOR: 'Азотный генератор',
  OTHER: 'Другое',
}

const statusLabels: Record<string, string> = {
  WORKING: 'Работает',
  STOPPED: 'Остановлен',
  REPAIR: 'В ремонте',
  PRESERVED: 'Консервация',
  DECOMMISSIONED: 'Списан',
}

const statusColors: Record<string, string> = {
  WORKING: 'bg-green-100 text-green-700',
  STOPPED: 'bg-gray-100 text-gray-700',
  REPAIR: 'bg-red-100 text-red-700',
  PRESERVED: 'bg-blue-100 text-blue-700',
  DECOMMISSIONED: 'bg-gray-100 text-gray-500',
}

function toDateInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

export default function EquipmentTechnicalData({
  equipmentId,
  initial,
  canEdit,
  canViewWarranty,
}: {
  equipmentId: string
  initial: Initial
  canEdit: boolean
  canViewWarranty: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [snap, setSnap] = useState(initial)

  const [form, setForm] = useState(() => ({
    type: initial.type,
    brand: initial.brand,
    model: initial.model,
    serialNumber: initial.serialNumber,
    yearOfManufacture: initial.yearOfManufacture != null ? String(initial.yearOfManufacture) : '',
    installDate: toDateInput(initial.installDate),
    warrantyUntil: toDateInput(initial.warrantyUntil),
    pressureBar: initial.pressureBar != null ? String(initial.pressureBar) : '',
    status: initial.status,
  }))

  function resetForm(from: Initial) {
    setForm({
      type: from.type,
      brand: from.brand,
      model: from.model,
      serialNumber: from.serialNumber,
      yearOfManufacture: from.yearOfManufacture != null ? String(from.yearOfManufacture) : '',
      installDate: toDateInput(from.installDate),
      warrantyUntil: toDateInput(from.warrantyUntil),
      pressureBar: from.pressureBar != null ? String(from.pressureBar) : '',
      status: from.status,
    })
  }

  async function save() {
    setLoading(true)
    try {
      const pressureParsed =
        form.pressureBar.trim() === ''
          ? null
          : Number.parseFloat(form.pressureBar.replace(',', '.'))
      const pressureBar = pressureParsed !== null && Number.isFinite(pressureParsed) ? pressureParsed : null

      const res = await fetch(`/api/equipment/${equipmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: form.type,
          brand: form.brand,
          model: form.model,
          serialNumber: form.serialNumber,
          yearOfManufacture: form.yearOfManufacture === '' ? null : form.yearOfManufacture,
          installDate: form.installDate || null,
          warrantyUntil: canViewWarranty ? form.warrantyUntil || null : snap.warrantyUntil,
          pressureBar,
          status: form.status,
          currentHours: snap.currentHours,
          nextServiceHours: snap.nextServiceHours,
          notes: snap.notes,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        alert(data?.error || 'Не удалось сохранить изменения')
        return
      }
      setEditing(false)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  function cancel() {
    resetForm(snap)
    setEditing(false)
  }

  useEffect(() => {
    if (editing) return
    setSnap(initial)
    resetForm(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- синхронизация с сервером после сохранения
  }, [
    editing,
    initial.brand,
    initial.model,
    initial.serialNumber,
    initial.type,
    initial.yearOfManufacture,
    initial.installDate,
    initial.warrantyUntil,
    initial.warrantyVoided,
    initial.status,
    initial.pressureBar,
  ])

  const warrantyUntilDate = snap.warrantyUntil ? new Date(snap.warrantyUntil) : null
  const ws = getWarrantyStatus(warrantyUntilDate, snap.warrantyVoided)

  return (
    <div className="bg-white border rounded-xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <h2 className="font-semibold flex items-center gap-2">⚙️ Технические данные</h2>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {!editing ? (
              <button
                type="button"
                onClick={() => {
                  resetForm(snap)
                  setEditing(true)
                }}
                className="text-sm border rounded-lg px-3 py-1.5 hover:bg-gray-50"
              >
                Редактировать
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={save}
                  disabled={loading}
                  className="text-sm bg-blue-600 text-white rounded-lg px-3 py-1.5 hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button
                  type="button"
                  onClick={cancel}
                  disabled={loading}
                  className="text-sm border rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
                >
                  Отмена
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1 sm:gap-2">
          <span className="text-gray-500 w-28 shrink-0">Тип:</span>
          {editing ? (
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="flex-1 min-w-0 border rounded-lg px-2 py-1.5 text-sm"
            >
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          ) : (
            <span>{typeLabels[snap.type] ?? snap.type}</span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1 sm:gap-2">
          <span className="text-gray-500 w-28 shrink-0">Бренд:</span>
          {editing ? (
            <input
              value={form.brand}
              onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
              className="flex-1 min-w-0 border rounded-lg px-2 py-1.5 text-sm font-medium"
            />
          ) : (
            <span className="font-medium">{snap.brand}</span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1 sm:gap-2">
          <span className="text-gray-500 w-28 shrink-0">Модель:</span>
          {editing ? (
            <input
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              className="flex-1 min-w-0 border rounded-lg px-2 py-1.5 text-sm font-medium"
            />
          ) : (
            <span className="font-medium">{snap.model}</span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1 sm:gap-2">
          <span className="text-gray-500 w-28 shrink-0">Серийный №:</span>
          {editing ? (
            <input
              value={form.serialNumber}
              onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))}
              className="flex-1 min-w-0 border rounded-lg px-2 py-1.5 text-sm font-mono"
            />
          ) : (
            <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{snap.serialNumber}</span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1 sm:gap-2">
          <span className="text-gray-500 w-28 shrink-0">Год выпуска:</span>
          {editing ? (
            <input
              type="number"
              min={1970}
              max={2100}
              value={form.yearOfManufacture}
              onChange={(e) => setForm((f) => ({ ...f, yearOfManufacture: e.target.value }))}
              placeholder="—"
              className="flex-1 min-w-0 border rounded-lg px-2 py-1.5 text-sm"
            />
          ) : (
            <span>{snap.yearOfManufacture ?? '—'}</span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1 sm:gap-2">
          <span className="text-gray-500 w-28 shrink-0">Установлен:</span>
          {editing ? (
            <input
              type="date"
              value={form.installDate}
              onChange={(e) => setForm((f) => ({ ...f, installDate: e.target.value }))}
              className="flex-1 min-w-0 border rounded-lg px-2 py-1.5 text-sm"
            />
          ) : (
            <span>{snap.installDate ? new Date(snap.installDate).toLocaleDateString('ru-RU') : '—'}</span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1 sm:gap-2">
          <span className="text-gray-500 w-28 shrink-0">Давление (bar):</span>
          {editing ? (
            <input
              type="number"
              inputMode="decimal"
              step="any"
              min={0}
              value={form.pressureBar}
              onChange={(e) => setForm((f) => ({ ...f, pressureBar: e.target.value }))}
              placeholder="—"
              className="flex-1 min-w-0 border rounded-lg px-2 py-1.5 text-sm max-w-[12rem]"
            />
          ) : (
            <span>{snap.pressureBar != null ? `${snap.pressureBar} bar` : '—'}</span>
          )}
        </div>

        {canViewWarranty && (
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1 sm:gap-2">
            <span className="text-gray-500 w-28 shrink-0">Гарантия до:</span>
            {editing ? (
              <input
                type="date"
                value={form.warrantyUntil}
                onChange={(e) => setForm((f) => ({ ...f, warrantyUntil: e.target.value }))}
                className="flex-1 min-w-0 border rounded-lg px-2 py-1.5 text-sm"
              />
            ) : (
              <span
                className={
                  ws === 'EXPIRED' ? 'text-red-600' : ws === 'EXPIRING' ? 'text-orange-600' : 'text-green-600'
                }
              >
                {snap.warrantyUntil ? new Date(snap.warrantyUntil).toLocaleDateString('ru-RU') : '—'}
              </span>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1 sm:gap-2">
          <span className="text-gray-500 w-28 shrink-0">Статус:</span>
          {editing ? (
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className="flex-1 min-w-0 max-w-xs border rounded-lg px-2 py-1.5 text-sm"
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          ) : (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium w-fit ${statusColors[snap.status]}`}>
              {statusLabels[snap.status] ?? snap.status}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

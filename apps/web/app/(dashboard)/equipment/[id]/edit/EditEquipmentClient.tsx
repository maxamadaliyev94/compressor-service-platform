'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function EditEquipmentClient({ equipment }: { equipment: any }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    type: equipment.type ?? 'COMPRESSOR',
    brand: equipment.brand ?? '',
    model: equipment.model ?? '',
    serialNumber: equipment.serialNumber ?? '',
    currentHours: String(equipment.currentHours ?? 0),
    nextServiceHours: equipment.nextServiceHours != null ? String(equipment.nextServiceHours) : '',
    warrantyUntil: equipment.warrantyUntil ? new Date(equipment.warrantyUntil).toISOString().slice(0, 10) : '',
    pressureBar:
      equipment.pressureBar != null && Number.isFinite(Number(equipment.pressureBar))
        ? String(equipment.pressureBar)
        : '',
    status: equipment.status ?? 'WORKING',
    notes: equipment.notes ?? '',
  })

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/equipment/${equipment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          currentHours: Number(form.currentHours) || 0,
          nextServiceHours: form.nextServiceHours === '' ? null : Number(form.nextServiceHours),
          warrantyUntil: form.warrantyUntil || null,
          pressureBar: form.pressureBar.trim() === '' ? null : Number(form.pressureBar.replace(',', '.')),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert((data as { error?: string }).error || 'Не удалось сохранить изменения')
        return
      }
      router.push('/equipment')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="bg-white border rounded-xl p-5 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Тип</label>
          <select value={form.type} onChange={(e) => set('type', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="COMPRESSOR">Компрессор</option>
            <option value="DRYER">Осушитель</option>
            <option value="RECEIVER">Ресивер</option>
            <option value="FILTER">Фильтр</option>
            <option value="NITROGEN_GENERATOR">Азотный генератор</option>
            <option value="OTHER">Другое</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Статус</label>
          <select value={form.status} onChange={(e) => set('status', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="WORKING">Работает</option>
            <option value="STOPPED">Остановлен</option>
            <option value="REPAIR">В ремонте</option>
            <option value="PRESERVED">Консервация</option>
            <option value="DECOMMISSIONED">Списан</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Бренд</label>
          <input value={form.brand} onChange={(e) => set('brand', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Модель</label>
          <input value={form.model} onChange={(e) => set('model', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Серийный номер</label>
        <input value={form.serialNumber} onChange={(e) => set('serialNumber', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Текущие моточасы</label>
          <input type="number" value={form.currentHours} onChange={(e) => set('currentHours', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Следующее ТО</label>
          <input type="number" value={form.nextServiceHours} onChange={(e) => set('nextServiceHours', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Гарантия до</label>
          <input type="date" value={form.warrantyUntil} onChange={(e) => set('warrantyUntil', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Давление (bar)</label>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            min={0}
            value={form.pressureBar}
            onChange={(e) => set('pressureBar', e.target.value)}
            placeholder="Необязательно"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Комментарий</label>
        <textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Сохранение...' : 'Сохранить'}
        </button>
        <a href="/equipment" className="border px-5 py-2 rounded-lg text-sm hover:bg-gray-50">
          Отмена
        </a>
      </div>
    </form>
  )
}

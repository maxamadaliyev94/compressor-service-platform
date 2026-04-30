'use client'
import { useState } from 'react'

interface Props {
  equipmentTypes: any[]
  brands: any[]
  isAdmin: boolean
}

const TYPE_LABELS: Record<string, string> = {
  COMPRESSOR: 'Компрессор',
  DRYER: 'Осушитель',
  RECEIVER: 'Ресивер',
  FILTER: 'Фильтр',
  NITROGEN_GENERATOR: 'Азотный генератор',
  OTHER: 'Другое',
}

export default function SettingsClient({ equipmentTypes, brands, isAdmin }: Props) {
  const [brandList, setBrandList] = useState(brands)
  const [newBrand, setNewBrand] = useState('')
  const [brandLoading, setBrandLoading] = useState(false)

  async function addBrand() {
    if (!newBrand.trim()) return
    setBrandLoading(true)
    const res = await fetch('/api/equipment-brands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newBrand.trim() })
    })
    if (res.ok) {
      const created = await res.json()
      setBrandList(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setNewBrand('')
    } else {
      const data = await res.json()
      alert(data.error)
    }
    setBrandLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <div>
            <h2 className="font-semibold">Типы оборудования</h2>
            <p className="text-xs text-gray-500 mt-0.5">Активные типы из регламентов ТО</p>
          </div>
          <span className="text-xs text-gray-400">{equipmentTypes.length} типов</span>
        </div>
        <div className="p-4">
          {equipmentTypes.length === 0 ? (
            <p className="text-sm text-gray-400">Нет данных</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {equipmentTypes.map((t: any) => (
                <span key={t.id} className="px-2.5 py-1 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-100">
                  {TYPE_LABELS[t.equipmentType] || t.equipmentType}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <div>
            <h2 className="font-semibold">Бренды оборудования</h2>
            <p className="text-xs text-gray-500 mt-0.5">Список доступных брендов при добавлении оборудования</p>
          </div>
          <span className="text-xs text-gray-400">{brandList.length} брендов</span>
        </div>
        <div className="grid grid-cols-3 gap-0 divide-y">
          {brandList.map((brand, i) => (
            <div key={brand.id}
              className={`flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 ${i % 3 !== 2 ? 'border-r' : ''}`}>
              <span className="text-sm font-medium">{brand.name}</span>
            </div>
          ))}
        </div>
        <div className="p-4 border-t bg-gray-50">
          <div className="flex gap-2">
            <input
              value={newBrand}
              onChange={e => setNewBrand(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addBrand()}
              placeholder="Название нового бренда (Fini, Abac...)"
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              disabled={!isAdmin}
            />
            <button onClick={addBrand} disabled={!newBrand.trim() || brandLoading || !isAdmin}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {brandLoading ? '...' : '+ Добавить'}
            </button>
          </div>
          {!isAdmin && (
            <p className="text-xs text-gray-400 mt-2">Только ADMIN может добавлять бренды.</p>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'
import { useState } from 'react'

interface Props {
  initialTypes: any[]
  initialBrands: any[]
  initialRegulations: any[]
  isAdmin: boolean
}

export default function ReferencesClient({ initialTypes, initialBrands, initialRegulations, isAdmin }: Props) {
  const [types, setTypes] = useState(initialTypes)
  const [brands, setBrands] = useState(initialBrands)
  const [regulations, setRegulations] = useState(initialRegulations)
  const [newType, setNewType] = useState('')
  const [newBrand, setNewBrand] = useState('')
  const [loadingType, setLoadingType] = useState(false)
  const [loadingBrand, setLoadingBrand] = useState(false)
  const [activeTab, setActiveTab] = useState<'types' | 'brands' | 'regulations'>('types')

  async function addType() {
    if (!newType.trim()) return
    setLoadingType(true)
    const res = await fetch('/api/equipment-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nameRu: newType.trim() })
    })
    if (res.ok) {
      const created = await res.json()
      setTypes(prev => [...prev, created])
      setNewType('')
    } else {
      const data = await res.json()
      alert(data.error || 'Ошибка')
    }
    setLoadingType(false)
  }

  async function deleteType(id: string) {
    if (!confirm('Удалить этот тип?')) return
    await fetch('/api/equipment-types', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    setTypes(prev => prev.filter(t => t.id !== id))
  }

  async function addBrand() {
    if (!newBrand.trim()) return
    setLoadingBrand(true)
    const res = await fetch('/api/equipment-brands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newBrand.trim() })
    })
    if (res.ok) {
      const created = await res.json()
      setBrands(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setNewBrand('')
    } else {
      const data = await res.json()
      alert(data.error || 'Бренд уже существует')
    }
    setLoadingBrand(false)
  }

  async function deleteBrand(id: string) {
    if (!confirm('Удалить этот бренд?')) return
    await fetch('/api/equipment-brands', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    setBrands(prev => prev.filter(b => b.id !== id))
  }

  return (
    <div className="max-w-4xl">
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setActiveTab('types')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'types'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}>
          ⚙️ Типы оборудования
          <span className="ml-2 bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
            {types.length}
          </span>
        </button>
        <button onClick={() => setActiveTab('brands')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'brands'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}>
          🏷️ Бренды
          <span className="ml-2 bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
            {brands.length}
          </span>
        </button>
        <button onClick={() => setActiveTab('regulations')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'regulations' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}>
          📋 Регламенты ТО
          <span className="ml-2 bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
            {regulations.length}
          </span>
        </button>
      </div>

      {activeTab === 'types' && (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <div>
              <h2 className="font-semibold">Типы оборудования</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Отображаются в выпадающем списке при добавлении оборудования
              </p>
            </div>
          </div>

          <div className="p-4 border-b bg-blue-50">
            <div className="flex gap-2">
              <input
                value={newType}
                onChange={e => setNewType(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addType()}
                placeholder="Название нового типа (Насос, Вентилятор, Маслоотделитель...)"
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <button onClick={addType} disabled={!newType.trim() || loadingType}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap">
                {loadingType ? '...' : '+ Добавить тип'}
              </button>
            </div>
          </div>

          <div className="divide-y">
            <div className="px-4 py-2 bg-gray-50">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Системные (нельзя удалить)</p>
            </div>
            {types.filter(t => t.isSystem).map(type => (
              <div key={type.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-sm">⚙️</div>
                  <div>
                    <div className="text-sm font-medium">{type.nameRu}</div>
                    <div className="text-xs text-gray-400">{type.name}</div>
                  </div>
                </div>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">Системный</span>
              </div>
            ))}

            {types.filter(t => !t.isSystem).length > 0 && (
              <>
                <div className="px-4 py-2 bg-gray-50">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Добавленные вами</p>
                </div>
                {types.filter(t => !t.isSystem).map(type => (
                  <div key={type.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-sm">⚙️</div>
                      <div>
                        <div className="text-sm font-medium">{type.nameRu}</div>
                      </div>
                    </div>
                    {isAdmin && (
                      <button onClick={() => deleteType(type.id)}
                        className="text-xs text-red-400 hover:text-red-600 px-3 py-1 rounded-lg hover:bg-red-50 transition-colors">
                        Удалить
                      </button>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'brands' && (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <div>
              <h2 className="font-semibold">Бренды оборудования</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Отображаются в поиске при добавлении оборудования
              </p>
            </div>
          </div>

          <div className="p-4 border-b bg-blue-50">
            <div className="flex gap-2">
              <input
                value={newBrand}
                onChange={e => setNewBrand(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addBrand()}
                placeholder="Название бренда (Fini, Abac, Worthington...)"
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <button onClick={addBrand} disabled={!newBrand.trim() || loadingBrand}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap">
                {loadingBrand ? '...' : '+ Добавить бренд'}
              </button>
            </div>
          </div>

          <div className="p-4">
            <div className="grid grid-cols-3 gap-2">
              {brands.map(brand => (
                <div key={brand.id}
                  className="flex items-center justify-between bg-gray-50 hover:bg-gray-100 rounded-lg px-3 py-2.5 transition-colors group">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-100 rounded text-xs flex items-center justify-center font-bold text-blue-700">
                      {brand.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium truncate">{brand.name}</span>
                  </div>
                  {isAdmin && (
                    <button onClick={() => deleteBrand(brand.id)}
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs ml-1 transition-opacity">
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'regulations' && (
        <div className="space-y-4">
          {regulations.map(reg => (
            <div key={reg.id} className="bg-white border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between p-4 bg-gray-50 border-b">
                <div>
                  <div className="font-semibold">{reg.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {reg.equipmentType} · {reg.intervalHours > 0 ? `каждые ${reg.intervalHours} м/ч` : 'по необходимости'}
                    {reg.description && ` · ${reg.description}`}
                  </div>
                </div>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                  {reg.items.length} пунктов
                </span>
              </div>
              <div className="divide-y">
                {reg.items.map((item: any, i: number) => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-5 h-5 bg-gray-100 rounded text-xs flex items-center justify-center text-gray-500 font-medium flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm text-gray-700">{item.label}</span>
                    {item.isRequired && (
                      <span className="ml-auto text-xs text-red-400">обязательно</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center text-sm text-blue-600">
            Для добавления нового регламента обратитесь к администратору
          </div>
        </div>
      )}
    </div>
  )
}

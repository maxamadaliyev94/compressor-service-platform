'use client'
import { useState } from 'react'

type RegulationItem = {
  id?: string
  label: string
  isRequired: boolean
}

type Regulation = {
  id: string
  name: string
  equipmentType: string
  intervalHours: number
  taskType: string
  description?: string | null
  items: RegulationItem[]
}

interface Props {
  initialTypes: any[]
  initialBrands: any[]
  initialRegulations: Regulation[]
  initialCities: { id: string; name: string; sortOrder: number }[]
  isAdmin: boolean
}

export default function ReferencesClient({
  initialTypes,
  initialBrands,
  initialRegulations,
  initialCities,
  isAdmin,
}: Props) {
  const [types, setTypes] = useState(initialTypes)
  const [brands, setBrands] = useState(initialBrands)
  const [regulations, setRegulations] = useState(initialRegulations)
  const [cities, setCities] = useState(initialCities)
  const [newType, setNewType] = useState('')
  const [newBrand, setNewBrand] = useState('')
  const [newCity, setNewCity] = useState('')
  const [loadingType, setLoadingType] = useState(false)
  const [loadingBrand, setLoadingBrand] = useState(false)
  const [loadingCity, setLoadingCity] = useState(false)
  const [loadingRegulation, setLoadingRegulation] = useState(false)
  const [activeTab, setActiveTab] = useState<'types' | 'brands' | 'regulations' | 'cities'>('types')
  const [editingRegulationId, setEditingRegulationId] = useState<string | null>(null)
  const [regulationForm, setRegulationForm] = useState({
    name: '',
    equipmentType: 'COMPRESSOR',
    taskType: 'PLANNED_MAINTENANCE',
    intervalHours: '2000',
    description: '',
    itemsText: '',
  })

  const taskLabels: Record<string, string> = {
    PLANNED_MAINTENANCE: 'Плановое ТО',
    DIAGNOSTICS: 'Диагностика',
    WARRANTY_REPAIR: 'Гарантийный ремонт',
    EMERGENCY: 'Аварийный выезд',
    INSTALLATION: 'Монтаж',
    COMMISSIONING: 'Пусконаладка',
  }

  const compressorChecklistItems = [
    'Замена масла',
    'Долив масла',
    'Замена масляного фильтра',
    'Замена сепаратора',
    'Устранение утечки масла',
    'Замена воздушного фильтра',
    'Очистка воздушного фильтра',
    'Замена панельного фильтра',
    'Очистка панельного фильтра',
    'Ремкомплект впускного клапана',
    'Замена впускного клапана',
    'Устранение утечки воздуха',
    'Замена клапана минимального давления',
    'Ремкомплект клапана минимального давления',
    'Замена обратного клапана',
    'Ремонт обратного клапана',
    'Замена регулятора давления',
    'Замена реле давления',
    'Очистка радиатора',
    'Продувка радиатора',
    'Замена радиатора',
    'Ремонт системы охлаждения',
    'Проверка состояния',
    'Замена подшипников винтового блока',
    'Замена сальников винтового блока',
    'Капитальный ремонт винтового блока',
    'Проверка ремней',
    'Замена ремней',
    'Натяжка ремней',
    'Проверка муфты',
    'Замена муфты',
    'Центровка',
    'Проверка состояния',
    'Смазка электродвигателя',
    'Замена подшипников электродвигателя',
    'Ремонт электродвигателя',
    'Проверка питания',
    'Протяжка клемм',
    'Замена контакторов / реле',
    'Замена контроллера',
    'Настройка контроллера',
    'Замена датчика давления',
    'Замена датчика температуры',
    'Проверка контроллера',
    'Устранение ошибок',
    'Проверка датчиков',
    'Калибровка датчиков',
    'Замена полиамидной трубки',
    'Замена фитингов',
    'Устранение утечек',
  ]

  const compressorDefaults = [
    { taskType: 'PLANNED_MAINTENANCE', name: 'Компрессор - Плановое ТО', intervalHours: 2000 },
    { taskType: 'DIAGNOSTICS', name: 'Компрессор - Диагностика', intervalHours: 0 },
    { taskType: 'WARRANTY_REPAIR', name: 'Компрессор - Гарантийный ремонт', intervalHours: 0 },
    { taskType: 'EMERGENCY', name: 'Компрессор - Аварийный выезд', intervalHours: 0 },
  ]

  function setRegulationField(field: string, value: string) {
    setRegulationForm((prev) => ({ ...prev, [field]: value }))
  }

  function normalizeChecklistItems(text: string) {
    return text
      .split('\n')
      .map((line) => line.replace(/^☐\s*/, '').trim())
      .filter(Boolean)
      .map((label) => ({ label, isRequired: false }))
  }

  function startCreateRegulation() {
    setEditingRegulationId(null)
    setRegulationForm({
      name: '',
      equipmentType: 'COMPRESSOR',
      taskType: 'PLANNED_MAINTENANCE',
      intervalHours: '2000',
      description: '',
      itemsText: '',
    })
  }

  function startEditRegulation(regulation: Regulation) {
    setEditingRegulationId(regulation.id)
    setRegulationForm({
      name: regulation.name,
      equipmentType: regulation.equipmentType,
      taskType: regulation.taskType,
      intervalHours: String(regulation.intervalHours ?? 0),
      description: regulation.description ?? '',
      itemsText: regulation.items.map((i) => i.label).join('\n'),
    })
  }

  async function saveRegulation() {
    const items = normalizeChecklistItems(regulationForm.itemsText)
    if (!regulationForm.name.trim()) {
      alert('Введите название регламента')
      return
    }
    if (items.length === 0) {
      alert('Добавьте хотя бы 1 пункт чек-листа')
      return
    }

    setLoadingRegulation(true)
    const method = editingRegulationId ? 'PATCH' : 'POST'
    const res = await fetch('/api/regulations', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingRegulationId,
        name: regulationForm.name.trim(),
        equipmentType: regulationForm.equipmentType,
        taskType: regulationForm.taskType,
        intervalHours: parseInt(regulationForm.intervalHours, 10) || 0,
        description: regulationForm.description.trim() || null,
        items,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      alert(data.error || 'Не удалось сохранить регламент')
      setLoadingRegulation(false)
      return
    }

    const updated = (await res.json()) as Regulation
    setRegulations((prev) => {
      if (!editingRegulationId) return [updated, ...prev]
      return prev.map((r) => (r.id === updated.id ? updated : r))
    })
    startCreateRegulation()
    setLoadingRegulation(false)
  }

  async function removeRegulation(id: string) {
    if (!confirm('Деактивировать этот чек-лист?')) return
    const res = await fetch('/api/regulations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (!res.ok) {
      alert('Не удалось удалить чек-лист')
      return
    }
    setRegulations((prev) => prev.filter((r) => r.id !== id))
  }

  async function createCompressorDefaults() {
    if (!isAdmin) return
    setLoadingRegulation(true)
    try {
      const existingTaskTypes = new Set(
        regulations
          .filter((r) => r.equipmentType === 'COMPRESSOR')
          .map((r) => r.taskType),
      )

      let created = 0
      for (const def of compressorDefaults) {
        if (existingTaskTypes.has(def.taskType)) continue
        const res = await fetch('/api/regulations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: def.name,
            equipmentType: 'COMPRESSOR',
            taskType: def.taskType,
            intervalHours: def.intervalHours,
            description: `Чек-лист для этапа: ${taskLabels[def.taskType]}`,
            items: compressorChecklistItems.map((label) => ({ label, isRequired: false })),
          }),
        })
        if (res.ok) {
          const row = (await res.json()) as Regulation
          setRegulations((prev) => [row, ...prev])
          created++
        }
      }
      alert(created > 0 ? `Создано чек-листов: ${created}` : 'Чек-листы для компрессора уже существуют')
    } finally {
      setLoadingRegulation(false)
    }
  }

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

  async function addCity() {
    if (!newCity.trim()) return
    setLoadingCity(true)
    const res = await fetch('/api/cities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCity.trim() }),
    })
    if (res.ok) {
      const created = (await res.json()) as { id: string; name: string; sortOrder: number }
      setCities((prev) =>
        [...prev, created].sort(
          (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ru'),
        ),
      )
      setNewCity('')
    } else {
      const data = await res.json()
      alert(data.error || 'Город уже существует')
    }
    setLoadingCity(false)
  }

  async function deleteCity(id: string) {
    if (!confirm('Удалить этот город из справочника?')) return
    const res = await fetch('/api/cities', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (!res.ok) {
      alert('Не удалось удалить город')
      return
    }
    setCities((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <div className="max-w-4xl">
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-full overflow-x-auto">
        <button onClick={() => setActiveTab('types')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
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
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
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
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === 'regulations' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}>
          📋 Регламенты ТО
          <span className="ml-2 bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
            {regulations.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('cities')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === 'cities'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          📍 Города
          <span className="ml-2 bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
            {cities.length}
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
            <div className="flex flex-col sm:flex-row gap-2">
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
            <div className="flex flex-col sm:flex-row gap-2">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
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

      {activeTab === 'cities' && (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <div>
              <h2 className="font-semibold">Города</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Список в форме создания и редактирования клиента
              </p>
            </div>
          </div>

          <div className="p-4 border-b bg-blue-50">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCity()}
                placeholder="Название города"
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <button
                onClick={addCity}
                disabled={!newCity.trim() || loadingCity}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
              >
                {loadingCity ? '...' : '+ Добавить город'}
              </button>
            </div>
          </div>

          <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {cities.map((city) => (
                <div
                  key={city.id}
                  className="flex items-center justify-between bg-gray-50 hover:bg-gray-100 rounded-lg px-3 py-2.5 transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 bg-emerald-100 rounded text-xs flex items-center justify-center font-bold text-emerald-700 flex-shrink-0">
                      {city.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium truncate">{city.name}</span>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => deleteCity(city.id)}
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs ml-1 transition-opacity flex-shrink-0"
                    >
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
          {isAdmin && (
            <div className="bg-white border rounded-xl p-4 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <h2 className="font-semibold">
                  {editingRegulationId ? 'Редактирование чек-листа' : 'Новый чек-лист'}
                </h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setRegulationField('itemsText', compressorChecklistItems.join('\n'))}
                    className="text-xs border rounded-lg px-3 py-1.5 hover:bg-gray-50"
                  >
                    Вставить шаблон компрессора
                  </button>
                  <button
                    onClick={createCompressorDefaults}
                    disabled={loadingRegulation}
                    className="text-xs border rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Создать 4 этапа компрессора
                  </button>
                  {editingRegulationId && (
                    <button
                      onClick={startCreateRegulation}
                      className="text-xs border rounded-lg px-3 py-1.5 hover:bg-gray-50"
                    >
                      Новый
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  value={regulationForm.name}
                  onChange={(e) => setRegulationField('name', e.target.value)}
                  placeholder="Название чек-листа"
                  className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={regulationForm.equipmentType}
                  onChange={(e) => setRegulationField('equipmentType', e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="COMPRESSOR">Компрессор</option>
                  <option value="DRYER">Осушитель</option>
                  <option value="RECEIVER">Ресивер</option>
                  <option value="FILTER">Фильтр</option>
                  <option value="NITROGEN_GENERATOR">Азотный генератор</option>
                  <option value="OTHER">Другое</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select
                  value={regulationForm.taskType}
                  onChange={(e) => setRegulationField('taskType', e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(taskLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={regulationForm.intervalHours}
                  onChange={(e) => setRegulationField('intervalHours', e.target.value)}
                  placeholder="Интервал м/ч"
                  className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  value={regulationForm.description}
                  onChange={(e) => setRegulationField('description', e.target.value)}
                  placeholder="Описание (необязательно)"
                  className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <textarea
                value={regulationForm.itemsText}
                onChange={(e) => setRegulationField('itemsText', e.target.value)}
                rows={10}
                placeholder="Пункты чек-листа, по одному в строке"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={saveRegulation}
                  disabled={loadingRegulation}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {loadingRegulation ? 'Сохранение...' : editingRegulationId ? 'Сохранить изменения' : 'Создать чек-лист'}
                </button>
                <p className="text-xs text-gray-500 self-center">
                  Формат: каждая строка = один пункт. Символ `☐` можно вставлять, он удаляется автоматически.
                </p>
              </div>
            </div>
          )}

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
              {isAdmin && (
                <div className="px-4 py-2 border-b bg-white flex gap-2">
                  <button
                    onClick={() => startEditRegulation(reg)}
                    className="text-xs border rounded-md px-2.5 py-1 hover:bg-gray-50"
                  >
                    Редактировать
                  </button>
                  <button
                    onClick={() => removeRegulation(reg.id)}
                    className="text-xs border border-red-200 text-red-600 rounded-md px-2.5 py-1 hover:bg-red-50"
                  >
                    Удалить
                  </button>
                </div>
              )}
              <div className="divide-y">
                {reg.items.map((item: any, i: number) => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-5 h-5 bg-gray-100 rounded text-xs flex items-center justify-center text-gray-500 font-medium flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm text-gray-700">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {!isAdmin && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center text-sm text-blue-600">
              Для добавления или изменения чек-листов обратитесь к администратору
            </div>
          )}
        </div>
      )}
    </div>
  )
}

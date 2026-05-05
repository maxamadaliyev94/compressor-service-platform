'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SearchableEquipment({
  equipment,
  canViewWarranty,
  canManageEquipment,
}: {
  equipment: any[]
  canViewWarranty: boolean
  canManageEquipment: boolean
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [filterType, setFilterType] = useState('ALL')
  const [filterWarranty, setFilterWarranty] = useState('ALL')
  const [showStopped, setShowStopped] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const msColors: Record<string, string> = {
    NORMAL: 'bg-green-100 text-green-800',
    WARNING: 'bg-yellow-100 text-yellow-800',
    URGENT: 'bg-orange-100 text-orange-800',
    OVERDUE: 'bg-red-100 text-red-800',
  }
  const msLabels: Record<string, string> = {
    NORMAL: 'Норма',
    WARNING: 'Скоро ТО',
    URGENT: 'Срочно',
    OVERDUE: 'Просрочено',
  }
  const wsColors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    EXPIRING: 'bg-orange-100 text-orange-800',
    EXPIRED: 'bg-gray-100 text-gray-600',
    VOIDED: 'bg-red-100 text-red-800',
  }
  const wsLabels: Record<string, string> = {
    ACTIVE: 'На гарантии',
    EXPIRING: 'Истекает',
    EXPIRED: 'Истекла',
    VOIDED: 'Аннулирована',
  }
  const typeLabels: Record<string, string> = {
    COMPRESSOR: 'Компрессор',
    DRYER: 'Осушитель',
    RECEIVER: 'Ресивер',
    FILTER: 'Фильтр',
    NITROGEN_GENERATOR: 'Азотный генератор',
    OTHER: 'Другое',
  }

  function getMS(eq: any) {
    if (!eq.nextServiceHours) return 'NORMAL'
    const diff = eq.nextServiceHours - eq.currentHours
    if (diff < 0) return 'OVERDUE'
    if (diff < 100) return 'URGENT'
    if (diff < 300) return 'WARNING'
    return 'NORMAL'
  }
  function getWS(eq: any) {
    if (eq.warrantyVoided) return 'VOIDED'
    if (!eq.warrantyUntil) return 'EXPIRED'
    const days = (new Date(eq.warrantyUntil).getTime() - Date.now()) / 86400000
    if (days < 0) return 'EXPIRED'
    if (days <= 30) return 'EXPIRING'
    return 'ACTIVE'
  }

  const filtered = equipment.filter((eq) => {
    const ms = getMS(eq)
    const ws = getWS(eq)
    const q = search.toLowerCase()
    const matchSearch =
      !search ||
      eq.brand.toLowerCase().includes(q) ||
      eq.model.toLowerCase().includes(q) ||
      eq.serialNumber.toLowerCase().includes(q) ||
      eq.object?.branch?.client?.name?.toLowerCase().includes(q)
    const matchStatus = filterStatus === 'ALL' || ms === filterStatus
    const matchType = filterType === 'ALL' || eq.type === filterType
    const matchWarranty =
      filterWarranty === 'ALL' ||
      (filterWarranty === 'ACTIVE' && (ws === 'ACTIVE' || ws === 'EXPIRING')) ||
      (filterWarranty === 'EXPIRED' && (ws === 'EXPIRED' || ws === 'VOIDED'))
    const matchStopped = showStopped || eq.status !== 'STOPPED'
    return matchSearch && matchStatus && matchType && matchWarranty && matchStopped
  })

  const sorted = [...filtered].sort((a, b) => {
    const getPriority = (eq: (typeof equipment)[0]) => {
      const diff = eq.nextServiceHours != null ? eq.nextServiceHours - eq.currentHours : 9999
      if (diff < 0) return 0
      if (diff < 100) return 1
      if (diff < 300) return 2
      return 3
    }
    return getPriority(a) - getPriority(b)
  })

  async function removeEquipment(id: string) {
    const ok = window.confirm('Удалить оборудование? Это действие нельзя отменить.')
    if (!ok) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/equipment/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert((data as { error?: string }).error || 'Не удалось удалить оборудование')
        return
      }
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:flex-wrap gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Поиск по бренду, модели, серийному номеру, клиенту..."
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="w-full md:w-auto border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">Все статусы ТО</option>
          <option value="OVERDUE">Просрочено</option>
          <option value="URGENT">Срочно ТО</option>
          <option value="WARNING">Скоро ТО</option>
          <option value="NORMAL">Норма</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="w-full md:w-auto border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">Все типы</option>
          <option value="COMPRESSOR">Компрессор</option>
          <option value="DRYER">Осушитель</option>
          <option value="RECEIVER">Ресивер</option>
          <option value="FILTER">Фильтр</option>
        </select>
        <select
          value={filterWarranty}
          onChange={(e) => setFilterWarranty(e.target.value)}
          className="w-full md:w-auto min-w-[150px] border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">Гарантия: Все</option>
          <option value="ACTIVE">На гарантии</option>
          <option value="EXPIRED">Истекла</option>
        </select>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Найдено: {filtered.length} из {equipment.length}
      </p>
      {equipment.filter((e: any) => e.status === 'STOPPED').length > 0 && (
        <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer hover:text-gray-700 mb-3">
          <input type="checkbox" checked={showStopped} onChange={e => setShowStopped(e.target.checked)}
            className="rounded w-3.5 h-3.5"/>
          Показать остановленное ({equipment.filter((e: any) => e.status === 'STOPPED').length})
        </label>
      )}
      <div className="md:hidden space-y-3">
        {sorted.length === 0 && (
          <div className="bg-white border rounded-lg p-6 text-center text-gray-400 text-sm">Ничего не найдено</div>
        )}
        {sorted.map((eq) => {
          const ms = getMS(eq)
          const ws = getWS(eq)
          return (
            <div key={eq.id} className="block bg-white border rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <a href={`/equipment/${eq.id}`} className="font-medium text-sm hover:text-blue-600">
                    {eq.brand} {eq.model}
                  </a>
                  <div className="text-xs text-gray-500">{eq.serialNumber}</div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${msColors[ms]}`}>{msLabels[ms]}</span>
              </div>
              <div className="mt-2 space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2"><span className="text-gray-500">Тип</span><span className="text-gray-700">{typeLabels[eq.type]}</span></div>
                <div className="flex items-center justify-between gap-2"><span className="text-gray-500">Клиент</span><span className="text-gray-700 text-right">{eq.object?.branch?.client?.name || '—'}</span></div>
                <div className="flex items-center justify-between gap-2"><span className="text-gray-500">Объект</span><span className="text-gray-700 text-right">{eq.object?.name || '—'}</span></div>
                <div className="flex items-center justify-between gap-2"><span className="text-gray-500">Моточасы</span><span className="text-gray-700">{eq.currentHours} м/ч</span></div>
                {eq.lastServiceDate && (
                  <div className="flex items-center justify-between gap-2"><span className="text-gray-500">Последнее ТО</span><span className="text-gray-700">{new Date(eq.lastServiceDate).toLocaleDateString('ru-RU')}</span></div>
                )}
                {canViewWarranty && <div className="flex items-center justify-between gap-2"><span className="text-gray-500">Гарантия</span><span className="text-gray-700">{wsLabels[ws]}</span></div>}
              </div>
              {canManageEquipment && (
                <div className="mt-3 flex flex-col gap-2">
                  <a
                    href={`/equipment/${eq.id}/edit`}
                    className="w-full min-h-11 border rounded-lg px-2 py-1.5 text-xs text-center hover:bg-gray-50 inline-flex items-center justify-center"
                  >
                    Редактировать
                  </a>
                  <button
                    type="button"
                    onClick={() => removeEquipment(eq.id)}
                    disabled={deletingId === eq.id}
                    className="w-full min-h-11 border border-red-200 text-red-700 rounded-lg px-2 py-1.5 text-xs hover:bg-red-50 disabled:opacity-50"
                  >
                    {deletingId === eq.id ? 'Удаление...' : 'Удалить'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="hidden md:block bg-white border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3 font-medium">Оборудование</th>
              <th className="text-left p-3 font-medium">Тип</th>
              <th className="text-left p-3 font-medium">Клиент / Объект</th>
              <th className="text-left p-3 font-medium">Моточасы</th>
              <th className="text-left p-3 font-medium">Последнее ТО</th>
              <th className="text-left p-3 font-medium">Статус ТО</th>
              <th className="text-left p-3 font-medium">Задача</th>
              {canViewWarranty && <th className="text-left p-3 font-medium">Гарантия</th>}
              {canManageEquipment && <th className="text-left p-3 font-medium">Действия</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={canViewWarranty ? (canManageEquipment ? 9 : 8) : canManageEquipment ? 8 : 7} className="p-8 text-center text-gray-400">
                  Ничего не найдено
                </td>
              </tr>
            )}
            {sorted.map((eq) => {
              const ms = getMS(eq)
              const ws = getWS(eq)
              return (
                <tr key={eq.id} className={`border-b last:border-0 hover:bg-gray-50 transition-colors ${eq.status === 'STOPPED' ? 'opacity-40' : ''}`}>
                  <td className="p-3">
                    <a href={`/equipment/${eq.id}`} className="font-medium hover:text-blue-600">
                      {eq.brand} {eq.model}
                    </a>
                    <div className="text-xs text-gray-500">{eq.serialNumber}</div>
                    {eq.status === 'STOPPED' && (
                      <div className="text-xs text-red-400 font-medium">Остановлен</div>
                    )}
                  </td>
                  <td className="p-3 text-gray-600">{typeLabels[eq.type]}</td>
                  <td className="p-3">
                    <div>{eq.object?.branch?.client?.name}</div>
                    <div className="text-xs text-gray-500">{eq.object?.name}</div>
                  </td>
                  <td className="p-3" style={{ minWidth: '160px' }}>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">{eq.currentHours} м/ч</span>
                        {eq.nextServiceHours && (
                          <span className={`font-bold ${
                            (eq.nextServiceHours - eq.currentHours) < 0 ? 'text-red-600' :
                            (eq.nextServiceHours - eq.currentHours) < 100 ? 'text-orange-600' :
                            (eq.nextServiceHours - eq.currentHours) < 300 ? 'text-yellow-600' :
                            'text-green-600'
                          }`}>
                            {eq.nextServiceHours - eq.currentHours < 0
                              ? `−${Math.abs(eq.nextServiceHours - eq.currentHours)} просрочено`
                              : `${eq.nextServiceHours - eq.currentHours} осталось`
                            }
                          </span>
                        )}
                      </div>
                      {eq.nextServiceHours && (() => {
                        const diff = eq.nextServiceHours - eq.currentHours
                        const lastService = eq.nextServiceHours - 2000
                        const total = 2000
                        const used = eq.currentHours - lastService
                        const pct = Math.min(Math.max((used / total) * 100, 0), 100)
                        const barColor = diff < 0 ? '#ef4444' : diff < 100 ? '#f97316' : diff < 300 ? '#eab308' : '#22c55e'
                        return (
                          <div>
                            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                              <div className="h-2 rounded-full transition-all"
                                style={{ width: `${pct}%`, backgroundColor: barColor }}/>
                            </div>
                            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                              <span>ТО {lastService > 0 ? lastService : 0}</span>
                              <span>ТО {eq.nextServiceHours}</span>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </td>
                  <td className="p-3 text-sm">
                    {eq.lastServiceDate ? (
                      <div>
                        <div className="text-gray-700">
                          {new Date(eq.lastServiceDate).toLocaleDateString('ru-RU')}
                        </div>
                        {eq.lastServiceHours != null && (
                          <div className="text-xs text-gray-400">{eq.lastServiceHours} м/ч</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${msColors[ms]}`}>
                      {msLabels[ms]}
                    </span>
                  </td>
                  <td className="p-3">
                    {eq.tasks && eq.tasks.length > 0 ? (
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse flex-shrink-0" />
                        <div>
                          <div className="text-xs font-medium text-blue-700">В работе</div>
                          {eq.tasks[0].assignedTo && (
                            <div className="text-xs text-gray-400">{eq.tasks[0].assignedTo.name}</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  {canViewWarranty && (
                    <td className="p-3">
                      <div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${wsColors[ws]}`}>
                          {wsLabels[ws]}
                        </span>
                        {eq.warrantyUntil && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            до {new Date(eq.warrantyUntil).toLocaleDateString('ru-RU')}
                          </div>
                        )}
                      </div>
                    </td>
                  )}
                  {canManageEquipment && (
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <a
                          href={`/equipment/${eq.id}/edit`}
                          className="border rounded px-2 py-1 text-xs hover:bg-gray-50"
                        >
                          Редактировать
                        </a>
                        <button
                          type="button"
                          onClick={() => removeEquipment(eq.id)}
                          disabled={deletingId === eq.id}
                          className="border border-red-200 text-red-700 rounded px-2 py-1 text-xs hover:bg-red-50 disabled:opacity-50"
                        >
                          {deletingId === eq.id ? 'Удаление...' : 'Удалить'}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}

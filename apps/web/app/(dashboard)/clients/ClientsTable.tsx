'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const statusColors: Record<string, string> = {
  VIP: 'bg-purple-100 text-purple-800',
  STANDART: 'bg-blue-100 text-blue-800',
  PASSIVE: 'bg-gray-100 text-gray-500',
}
const statusLabels: Record<string, string> = {
  VIP: 'VIP',
  STANDART: 'Стандарт',
  PASSIVE: 'Пассивный',
}

function StatusToggle({ client, isAdmin }: { client: any, isAdmin: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const isPassive = client.status === 'PASSIVE'

  async function changeStatus(status: string) {
    setLoading(true)
    setShowMenu(false)
    await fetch(`/api/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
    setLoading(false)
    router.refresh()
    if (status === 'PASSIVE') {
      // уже видно по обновлению таблицы
    }
  }

  if (!isAdmin) {
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[client.status]}`}>
        {statusLabels[client.status]}
      </span>
    )
  }

  return (
    <div className="relative flex items-center gap-2">
      <button
        onClick={() => changeStatus(isPassive ? 'STANDART' : 'PASSIVE')}
        disabled={loading}
        title={isPassive ? 'Включить клиента' : 'Отключить клиента'}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
          !isPassive ? 'bg-green-500' : 'bg-gray-300'
        } ${loading ? 'opacity-50' : 'cursor-pointer'}`}>
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          !isPassive ? 'translate-x-4' : 'translate-x-0.5'
        }`}/>
      </button>

      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusColors[client.status]} hover:opacity-80`}>
          {statusLabels[client.status]}
          <span className="text-xs">▾</span>
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)}/>
            <div className="absolute right-0 top-7 w-44 bg-white border rounded-xl shadow-xl z-20 overflow-hidden">
              <div className="p-1">
                {['VIP', 'STANDART', 'PASSIVE'].map((s) => (
                  <button key={s} onClick={() => changeStatus(s)}
                    disabled={client.status === s}
                    className={`w-full text-left px-3 py-2 text-xs rounded-lg flex items-center gap-2 transition-colors
                      ${client.status === s ? 'opacity-40 cursor-not-allowed bg-gray-50' : 'hover:bg-gray-50'}`}>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      s === 'VIP' ? 'bg-purple-500' :
                      s === 'STANDART' ? 'bg-blue-500' :
                      'bg-gray-400'
                    }`}/>
                    {statusLabels[s]}
                    {client.status === s && <span className="ml-auto text-gray-400">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function ClientsTable({ clients, isAdmin }: { clients: any[], isAdmin: boolean }) {
  const [search, setSearch] = useState('')
  const [filterCity, setFilterCity] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [showArchived, setShowArchived] = useState(false)

  const cities = [...new Set(clients.map((c: any) => c.city).filter(Boolean))] as string[]

  const filtered = clients.filter((c: any) => {
    const q = search.toLowerCase()
    const matchSearch = !search ||
      c.name.toLowerCase().includes(q) ||
      c.contactPerson?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.inn?.includes(q)
    const matchCity = filterCity === 'ALL' || c.city === filterCity
    const matchStatus = filterStatus === 'ALL' || c.status === filterStatus
    const matchArchived = showArchived || c.status !== 'PASSIVE'
    return matchSearch && matchCity && matchStatus && matchArchived
  })

  const archivedCount = clients.filter(c => c.status === 'PASSIVE').length

  return (
    <div>
      <div className="flex gap-3 mb-3">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Поиск по названию, контакту, телефону, ИНН..."
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        <select value={filterCity} onChange={e => setFilterCity(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="ALL">Все города (UZ)</option>
          {cities.map(city => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="ALL">Все статусы</option>
          <option value="VIP">VIP</option>
          <option value="STANDART">Стандарт</option>
          <option value="PASSIVE">Пассивный</option>
        </select>
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-400">Найдено: {filtered.length} из {clients.length}</p>
        {isAdmin && archivedCount > 0 && (
          <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer hover:text-gray-700">
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)}
              className="rounded w-3.5 h-3.5"/>
            Показать отключённых ({archivedCount})
          </label>
        )}
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3 font-medium">Клиент</th>
              <th className="text-left p-3 font-medium">Город</th>
              <th className="text-left p-3 font-medium">Контакт</th>
              <th className="text-left p-3 font-medium">Телефон</th>
              <th className="text-left p-3 font-medium">Оборудования</th>
              <th className="text-left p-3 font-medium">Статус</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400">Ничего не найдено</td></tr>
            )}
            {filtered.map((client: any) => {
              const equipCount = client.branches?.flatMap((b: any) => b.objects).flatMap((o: any) => o.equipment).length || 0
              const isArchived = client.status === 'PASSIVE'
              return (
                <tr key={client.id}
                  className={`border-b last:border-0 hover:bg-gray-50 transition-colors 
  ${client.status === 'PASSIVE' ? 'opacity-40' : ''}
  ${client.status === 'VIP' ? 'bg-purple-50/30' : ''}
`}>
                  <td className="p-3">
                    <a href={`/clients/${client.id}`}
                      className={`font-medium hover:text-blue-600 ${isArchived ? 'line-through text-gray-400' : ''}`}>
                      {client.name}
                    </a>
                    {client.inn && <div className="text-xs text-gray-400">ИНН: {client.inn}</div>}
                    {isArchived && (
                      <div className="text-xs text-red-400 font-medium">Пассивный</div>
                    )}
                  </td>
                  <td className="p-3">
                    {client.city ? (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-xs font-medium">
                          UZ
                        </span>
                        <span className="text-sm text-gray-700">{client.city}</span>
                      </div>
                    ) : <span className="text-gray-300 text-sm">—</span>}
                  </td>
                  <td className="p-3 text-gray-600">{client.contactPerson || '—'}</td>
                  <td className="p-3 text-gray-600">{client.phone || '—'}</td>
                  <td className="p-3 text-center font-medium">{equipCount}</td>
                  <td className="p-3">
                    <StatusToggle client={client} isAdmin={isAdmin} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

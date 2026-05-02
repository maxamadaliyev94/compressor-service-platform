'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Manager = {
  id: string
  name: string
  email?: string | null
  phone?: string | null
}

type ClientRow = {
  id: string
  name: string
  inn?: string | null
  contactPerson?: string | null
  phone?: string | null
  city?: string | null
  status: 'VIP' | 'STANDART' | 'PASSIVE'
  managerId?: string | null
  manager?: Manager | null
  branches?: { objects: { equipment: { id: string }[] }[] }[]
}

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

function ManagerAssignModal({
  open,
  client,
  managers,
  loading,
  onClose,
  onAssign,
  onRemove,
}: {
  open: boolean
  client: ClientRow | null
  managers: Manager[]
  loading: boolean
  onClose: () => void
  onAssign: (managerId: string) => Promise<void>
  onRemove: () => Promise<void>
}) {
  const [selectedManagerId, setSelectedManagerId] = useState<string>('')

  if (!open || !client) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-0 md:p-4">
      <div className="w-full md:max-w-md rounded-t-2xl md:rounded-xl bg-white border p-4">
        <h3 className="text-base font-semibold mb-2">Назначить менеджера</h3>
        <p className="text-sm text-gray-600 mb-3">Клиент: {client.name}</p>
        <select
          value={selectedManagerId}
          onChange={(e) => setSelectedManagerId(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
        >
          <option value="">Выберите менеджера</option>
          {managers.map((manager) => (
            <option key={manager.id} value={manager.id}>
              {manager.name}
            </option>
          ))}
        </select>
        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          {client.managerId && (
            <button
              onClick={() => onRemove()}
              disabled={loading}
              className="w-full sm:w-auto min-h-11 px-3 py-2 rounded-lg text-sm border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              Снять менеджера
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full sm:w-auto min-h-11 px-3 py-2 rounded-lg text-sm border hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            onClick={() => selectedManagerId && onAssign(selectedManagerId)}
            disabled={loading || !selectedManagerId}
            className="w-full sm:w-auto min-h-11 px-3 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}

function StatusToggle({ client, isAdmin }: { client: ClientRow, isAdmin: boolean }) {
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

export default function ClientsTable({
  clients,
  isAdmin,
  canEditClient,
}: {
  clients: ClientRow[]
  isAdmin: boolean
  canEditClient: boolean
}) {
  const [search, setSearch] = useState('')
  const [filterCity, setFilterCity] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [showArchived, setShowArchived] = useState(false)
  const [managers, setManagers] = useState<Manager[]>([])
  const [loadingManagers, setLoadingManagers] = useState(false)
  const [managerSaving, setManagerSaving] = useState(false)
  const [managerModalOpen, setManagerModalOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ClientRow | null>(null)
  const [deleteText, setDeleteText] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const router = useRouter()

  const showActionsCol = canEditClient || isAdmin
  const tableColSpan = 6 + (isAdmin ? 1 : 0) + (showActionsCol ? 1 : 0)

  const cities = [...new Set(clients.map((c) => c.city).filter(Boolean))] as string[]

  const filtered = clients.filter((c) => {
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

  async function openAssignModal(client: ClientRow) {
    setSelectedClient(client)
    setManagerModalOpen(true)
    if (managers.length > 0 || loadingManagers) return
    setLoadingManagers(true)
    const response = await fetch('/api/users')
    const users = await response.json()
    const onlyManagers = Array.isArray(users) ? users.filter((u) => u.role === 'MANAGER' && u.isActive) : []
    setManagers(onlyManagers)
    setLoadingManagers(false)
  }

  async function assignManager(managerId: string) {
    if (!selectedClient) return
    setManagerSaving(true)
    await fetch(`/api/clients/${selectedClient.id}/manager`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ managerId }),
    })
    setManagerSaving(false)
    setManagerModalOpen(false)
    setSelectedClient(null)
    router.refresh()
  }

  async function removeManager() {
    if (!selectedClient) return
    setManagerSaving(true)
    await fetch(`/api/clients/${selectedClient.id}/manager`, { method: 'DELETE' })
    setManagerSaving(false)
    setManagerModalOpen(false)
    setSelectedClient(null)
    router.refresh()
  }

  async function confirmDeleteClient() {
    if (!deleteTarget || deleteText !== deleteTarget.name) return
    setDeleteLoading(true)
    const res = await fetch(`/api/clients/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleteLoading(false)
    if (res.ok) {
      setDeleteTarget(null)
      setDeleteText('')
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      alert((data as { error?: string }).error ?? 'Ошибка удаления')
    }
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row gap-2 md:gap-3 mb-3">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Поиск по названию, контакту, телефону, ИНН..."
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        <select value={filterCity} onChange={e => setFilterCity(e.target.value)}
          className="w-full md:w-auto border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="ALL">Все города (UZ)</option>
          {cities.map(city => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="w-full md:w-auto border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
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

      <div className="md:hidden space-y-3">
        {filtered.length === 0 && (
          <div className="bg-white border rounded-xl p-6 text-center text-gray-400 text-sm">Ничего не найдено</div>
        )}
        {filtered.map((client) => {
          const equipCount =
            client.branches?.flatMap((b) => b.objects).flatMap((o) => o.equipment).length || 0
          const isArchived = client.status === 'PASSIVE'
          return (
            <div key={client.id} className={`bg-white border rounded-xl p-3 ${isArchived ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <a href={`/clients/${client.id}`} className={`font-medium text-sm hover:text-blue-600 ${isArchived ? 'line-through' : ''}`}>
                  {client.name}
                </a>
                <StatusToggle client={client} isAdmin={isAdmin} />
              </div>
              {client.inn && <div className="text-xs text-gray-400 mt-0.5">ИНН: {client.inn}</div>}
              <div className="mt-2 space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2"><span className="text-gray-500">Город</span><span className="text-gray-700">{client.city || '—'}</span></div>
                <div className="flex items-center justify-between gap-2"><span className="text-gray-500">Контакт</span><span className="text-gray-700">{client.contactPerson || '—'}</span></div>
                <div className="flex items-center justify-between gap-2"><span className="text-gray-500">Телефон</span><span className="text-gray-700">{client.phone || '—'}</span></div>
                {isAdmin && <div className="flex items-center justify-between gap-2"><span className="text-gray-500">Менеджер</span><span className="text-gray-700">{client.manager?.name || 'Не назначен'}</span></div>}
                <div className="flex items-center justify-between gap-2"><span className="text-gray-500">Оборудование</span><span className="text-gray-700">{equipCount}</span></div>
              </div>
              {isAdmin && (
                <button
                  onClick={() => openAssignModal(client)}
                  className="mt-2 w-full min-h-11 text-xs px-3 py-2 rounded border hover:bg-gray-50"
                >
                  {client.managerId ? 'Сменить менеджера' : 'Назначить менеджера'}
                </button>
              )}
              {showActionsCol && (
                <div className="mt-2 flex gap-2">
                  {canEditClient && (
                    <a
                      href={`/clients/${client.id}/edit`}
                      className="flex-1 min-h-11 text-xs px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-center text-gray-700"
                    >
                      Изменить
                    </a>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteTarget(client)
                        setDeleteText('')
                      }}
                      className="flex-1 min-h-11 text-xs px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                    >
                      Удалить
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="hidden md:block bg-white border rounded-xl overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3 font-medium">Клиент</th>
              <th className="text-left p-3 font-medium">Город</th>
              <th className="text-left p-3 font-medium">Контакт</th>
              <th className="text-left p-3 font-medium">Телефон</th>
              <th className="text-left p-3 font-medium">Оборудования</th>
              {isAdmin && <th className="text-left p-3 font-medium">Менеджер</th>}
              <th className="text-left p-3 font-medium">Статус</th>
              {showActionsCol && (
                <th className="text-right p-3 font-medium whitespace-nowrap">Действия</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={tableColSpan} className="p-8 text-center text-gray-400">
                  Ничего не найдено
                </td>
              </tr>
            )}
            {filtered.map((client) => {
              const equipCount = client.branches?.flatMap((b) => b.objects).flatMap((o) => o.equipment).length || 0
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
                  {isAdmin && (
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-700">{client.manager?.name || 'Не назначен'}</span>
                        <button
                          onClick={() => openAssignModal(client)}
                          className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
                        >
                          {client.managerId ? 'Сменить' : 'Назначить'}
                        </button>
                      </div>
                    </td>
                  )}
                  <td className="p-3">
                    <StatusToggle client={client} isAdmin={isAdmin} />
                  </td>
                  {showActionsCol && (
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {canEditClient && (
                          <a
                            href={`/clients/${client.id}/edit`}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 whitespace-nowrap"
                          >
                            Изменить
                          </a>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteTarget(client)
                              setDeleteText('')
                            }}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 whitespace-nowrap"
                          >
                            Удалить
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <ManagerAssignModal
        open={managerModalOpen}
        client={selectedClient}
        managers={managers}
        loading={managerSaving || loadingManagers}
        onClose={() => {
          setManagerModalOpen(false)
          setSelectedClient(null)
        }}
        onAssign={assignManager}
        onRemove={removeManager}
      />

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">⚠️</div>
              <h2 className="text-lg font-bold text-gray-900">Удалить клиента?</h2>
              <p className="text-sm text-gray-500 mt-1">
                Это действие нельзя отменить. Будут удалены все данные клиента.
              </p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-700 font-medium">{deleteTarget.name}</p>
              {deleteTarget.city && <p className="text-xs text-red-500">{deleteTarget.city}</p>}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Введите название клиента для подтверждения:
              </label>
              <input
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                placeholder={deleteTarget.name}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void confirmDeleteClient()}
                disabled={deleteText !== deleteTarget.name || deleteLoading}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deleteLoading ? 'Удаление...' : 'Удалить навсегда'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null)
                  setDeleteText('')
                }}
                className="flex-1 border py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

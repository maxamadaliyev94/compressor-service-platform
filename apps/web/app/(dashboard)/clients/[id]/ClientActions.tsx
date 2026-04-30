'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const statusLabels: Record<string, string> = {
  VIP: '⭐ VIP', STANDART: 'Стандарт', PASSIVE: 'Пассивный',
}
const statusColors: Record<string, string> = {
  VIP: 'text-purple-700 bg-purple-50 border-purple-200',
  STANDART: 'text-blue-700 bg-blue-50 border-blue-200',
  PASSIVE: 'text-gray-500 bg-gray-50 border-gray-200',
}

export default function ClientActions({ client, isAdmin }: { client: any, isAdmin: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteText, setDeleteText] = useState('')

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
  }

  async function deleteClient() {
    if (deleteText !== client.name) return
    setLoading(true)
    const res = await fetch(`/api/clients/${client.id}`, { method: 'DELETE' })
    setLoading(false)
    if (res.ok) {
      router.push('/clients')
    } else {
      const data = await res.json()
      alert(data.error || 'Ошибка удаления')
      setShowDeleteConfirm(false)
    }
  }

  if (!isAdmin) return null

  return (
    <>
      <div className="relative">
        <button onClick={() => setShowMenu(!showMenu)} disabled={loading}
          className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-2">
          ⚙️ Управление
          <span className="text-gray-400">▾</span>
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)}/>
            <div className="absolute right-0 top-10 w-56 bg-white border rounded-xl shadow-xl z-20 overflow-hidden">
              <div className="p-2 border-b">
                <p className="text-xs text-gray-500 px-2 py-1">Сменить статус</p>
                {['VIP', 'STANDART', 'PASSIVE'].map((s) => (
                  <button key={s} onClick={() => changeStatus(s)}
                    disabled={client.status === s}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center gap-2 transition-colors
                      ${client.status === s ? 'opacity-40 cursor-not-allowed bg-gray-50' : 'hover:bg-gray-50'}`}>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                      s === 'VIP' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                      s === 'STANDART' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                      'bg-gray-100 text-gray-500 border-gray-200'
                    }`}>
                      {s === 'VIP' ? '⭐ VIP' : s === 'STANDART' ? 'Стандарт' : 'Пассивный'}
                    </span>
                    {client.status === s && <span className="text-xs text-gray-400">← текущий</span>}
                  </button>
                ))}
              </div>
              <div className="p-2">
                <button onClick={() => { setShowMenu(false); setShowDeleteConfirm(true) }}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2">
                  🗑️ Удалить клиента
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">⚠️</div>
              <h2 className="text-lg font-bold text-gray-900">Удалить клиента?</h2>
              <p className="text-sm text-gray-500 mt-1">
                Это действие нельзя отменить. Будут удалены все данные клиента.
              </p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-700 font-medium">{client.name}</p>
              {client.city && <p className="text-xs text-red-500">{client.city}</p>}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Введите название клиента для подтверждения:
              </label>
              <input value={deleteText} onChange={e => setDeleteText(e.target.value)}
                placeholder={client.name}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"/>
            </div>

            <div className="flex gap-3">
              <button onClick={deleteClient}
                disabled={deleteText !== client.name || loading}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {loading ? 'Удаление...' : '🗑️ Удалить навсегда'}
              </button>
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteText('') }}
                className="flex-1 border py-2 rounded-lg text-sm hover:bg-gray-50">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

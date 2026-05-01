'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Manager = {
  id: string
  name: string
  email?: string | null
  phone?: string | null
}

export default function ClientManagerCard({
  clientId,
  manager,
  canManage,
}: {
  clientId: string
  manager: Manager | null
  canManage: boolean
}) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [managers, setManagers] = useState<Manager[]>([])
  const [selectedManagerId, setSelectedManagerId] = useState('')
  const [loading, setLoading] = useState(false)

  async function loadManagers() {
    if (managers.length > 0) return
    setLoading(true)
    const response = await fetch('/api/users')
    const users = await response.json()
    setManagers(Array.isArray(users) ? users.filter((u) => u.role === 'MANAGER' && u.isActive) : [])
    setLoading(false)
  }

  async function assignManager() {
    if (!selectedManagerId) return
    setLoading(true)
    await fetch(`/api/clients/${clientId}/manager`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ managerId: selectedManagerId }),
    })
    setLoading(false)
    setModalOpen(false)
    router.refresh()
  }

  async function removeManager() {
    setLoading(true)
    await fetch(`/api/clients/${clientId}/manager`, { method: 'DELETE' })
    setLoading(false)
    setModalOpen(false)
    router.refresh()
  }

  return (
    <div className="bg-white border rounded-xl p-5 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <h2 className="font-semibold">Ответственный менеджер</h2>
        {canManage && (
          <button
            onClick={async () => {
              setModalOpen(true)
              await loadManagers()
            }}
            className="px-3 py-1.5 rounded-lg text-xs border hover:bg-gray-50"
          >
            {manager ? 'Сменить менеджера' : 'Назначить менеджера'}
          </button>
        )}
      </div>

      {manager ? (
        <div className="space-y-1 text-sm">
          <div className="font-medium">{manager.name}</div>
          <div className="text-gray-600">{manager.phone || 'Телефон не указан'}</div>
          <div className="text-gray-600">{manager.email || 'Email не указан'}</div>
        </div>
      ) : (
        <div className="text-sm text-gray-500">Менеджер не назначен</div>
      )}

      {modalOpen && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white border p-4">
            <h3 className="text-base font-semibold mb-2">Назначить менеджера</h3>
            <select
              value={selectedManagerId}
              onChange={(e) => setSelectedManagerId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
            >
              <option value="">Выберите менеджера</option>
              {managers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              {manager && (
                <button
                  onClick={removeManager}
                  disabled={loading}
                  className="px-3 py-2 rounded-lg text-sm border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  Снять менеджера
                </button>
              )}
              <button
                onClick={() => setModalOpen(false)}
                className="px-3 py-2 rounded-lg text-sm border hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={assignManager}
                disabled={loading || !selectedManagerId}
                className="px-3 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

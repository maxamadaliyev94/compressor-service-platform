'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type AttachedUser = {
  id: string
  name: string
  login: string
  email?: string | null
}

type UserOption = {
  id: string
  name: string
  login: string
  email?: string | null
  clientId: string | null
}

export default function ClientAttachedNotifyUserCard({
  clientId,
  attachedUser,
  canManage,
}: {
  clientId: string
  attachedUser: AttachedUser | null
  canManage: boolean
}) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [users, setUsers] = useState<UserOption[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [loading, setLoading] = useState(false)

  async function loadUsers() {
    if (users.length > 0) return
    setLoading(true)
    const response = await fetch(`/api/clients/${clientId}/notify-candidates`)
    const list = await response.json()
    if (!response.ok) {
      alert((list as { error?: string }).error || 'Не удалось загрузить список')
      setUsers([])
      setLoading(false)
      return
    }
    const arr = Array.isArray(list) ? list : []
    setUsers(arr as UserOption[])
    setLoading(false)
  }

  async function saveAttached() {
    if (!selectedUserId) return
    setLoading(true)
    const res = await fetch(`/api/clients/${clientId}/attached-notify-user`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: selectedUserId }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      alert((data as { error?: string }).error || 'Не удалось сохранить')
      return
    }
    setModalOpen(false)
    setSelectedUserId('')
    router.refresh()
  }

  async function clearAttached() {
    setLoading(true)
    await fetch(`/api/clients/${clientId}/attached-notify-user`, { method: 'DELETE' })
    setLoading(false)
    setModalOpen(false)
    router.refresh()
  }

  return (
    <div className="bg-white border rounded-xl p-5 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <div>
          <h2 className="font-semibold">Уведомления о работах</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Выберите учётную запись владельца или представителя компании (роль «Клиент», вход в личный кабинет) — на
            неё будут приходить уведомления о задачах на оборудовании этого клиента.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={async () => {
              setModalOpen(true)
              await loadUsers()
            }}
            className="px-3 py-1.5 rounded-lg text-xs border hover:bg-gray-50 shrink-0"
          >
            {attachedUser ? 'Сменить пользователя' : 'Прикрепить пользователя'}
          </button>
        )}
      </div>

      {attachedUser ? (
        <div className="space-y-1 text-sm">
          <div className="font-medium">{attachedUser.name}</div>
          <div className="text-gray-600">{attachedUser.login}</div>
          {attachedUser.email && <div className="text-gray-600">{attachedUser.email}</div>}
        </div>
      ) : (
        <div className="text-sm text-gray-500">Представитель компании для уведомлений не выбран</div>
      )}

      {modalOpen && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white border p-4">
            <h3 className="text-base font-semibold mb-2">Представитель компании</h3>
            <p className="text-xs text-gray-500 mb-2">
              В списке — пользователи с ролью «Клиент», привязанные к этой компании или ещё без привязки (при сохранении
              учётная запись будет привязана к этому клиенту).
            </p>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
            >
              <option value="">Выберите учётную запись</option>
              {users.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.login})
                  {item.clientId === clientId ? ' — эта компания' : ' — без привязки к компании'}
                </option>
              ))}
            </select>
            {users.length === 0 && !loading && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
                Нет подходящих учётных записей. Создайте пользователя с ролью «Клиент» в разделе «Пользователи», затем
                откройте этот диалог снова.
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              {attachedUser && (
                <button
                  type="button"
                  onClick={clearAttached}
                  disabled={loading}
                  className="px-3 py-2 rounded-lg text-sm border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  Открепить
                </button>
              )}
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-3 py-2 rounded-lg text-sm border hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={saveAttached}
                disabled={loading || !selectedUserId}
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

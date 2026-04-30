'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function UserActions({ user, currentUserEmail }: { user: any, currentUserEmail?: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const isSelf = user.email === currentUserEmail

  async function toggle() {
    if (isSelf) { alert('Нельзя деактивировать свой аккаунт'); return }
    setLoading(true)
    await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle' })
    })
    setLoading(false)
    router.refresh()
  }

  async function resetPassword() {
    if (!confirm(`Сбросить пароль ${user.name} на "password123"?`)) return
    setLoading(true)
    await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resetPassword' })
    })
    setLoading(false)
    alert('✅ Пароль сброшен на: password123')
  }

  async function deleteUser() {
    if (isSelf) { alert('Нельзя удалить свой аккаунт'); return }
    if (user.role === 'ADMIN') { alert('Нельзя удалить администратора'); return }
    if (!confirm(`Удалить пользователя "${user.name}"?\n\nЭто действие нельзя отменить.`)) return
    setLoading(true)
    const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' })
    setLoading(false)
    if (res.ok) {
      router.refresh()
    } else {
      alert('Ошибка удаления. Возможно у пользователя есть связанные задачи.')
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={toggle} disabled={loading || isSelf}
        title={user.isActive ? 'Деактивировать' : 'Активировать'}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${user.isActive ? 'bg-green-500' : 'bg-gray-300'} ${isSelf ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${user.isActive ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
      <button onClick={resetPassword} disabled={loading}
        title="Сбросить пароль"
        className="text-xs text-gray-400 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors">
        🔑 Пароль
      </button>
      {!isSelf && user.role !== 'ADMIN' && (
        <button onClick={deleteUser} disabled={loading}
          title="Удалить пользователя"
          className="text-xs text-gray-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors">
          🗑️ Удалить
        </button>
      )}
    </div>
  )
}

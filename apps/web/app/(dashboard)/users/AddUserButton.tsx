'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import RegisterFaceIdButton from './RegisterFaceIdButton'

const roleLabels: Record<string, string> = {
  ADMIN: 'Администратор',
  MANAGER: 'Менеджер',
  CHIEF_ENGINEER: 'Главный инженер',
  ENGINEER: 'Инженер',
  CLIENT: 'Клиент',
}

export default function AddUserButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [createdUserId, setCreatedUserId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', login: '', email: '', phone: '', role: 'ENGINEER', password: 'password123' })

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function closeModal() {
    setOpen(false)
    setCreatedUserId(null)
    setForm({ name: '', login: '', email: '', phone: '', role: 'ENGINEER', password: 'password123' })
    router.refresh()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setCreatedUserId(null)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      alert((data as { error?: string }).error || 'Ошибка создания пользователя')
      return
    }
    const id = (data as { id?: string }).id
    if (id) setCreatedUserId(id)
    else closeModal()
  }

  return (
    <>
      <button
        onClick={() => {
          setCreatedUserId(null)
          setOpen(true)
        }}
        className="w-full md:w-auto min-h-11 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
      >
        + Добавить пользователя
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white rounded-t-2xl md:rounded-xl p-4 md:p-6 w-full md:max-w-md shadow-xl max-h-[92vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">{createdUserId ? 'Пользователь создан' : 'Новый пользователь'}</h2>
            {createdUserId ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  При необходимости зарегистрируйте Face ID или Touch ID на <strong>этом устройстве</strong> для входа под
                  созданным пользователем.
                </p>
                <RegisterFaceIdButton userId={createdUserId} />
                <button type="button" onClick={closeModal} className="w-full min-h-11 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                  Закрыть
                </button>
              </div>
            ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">ФИО *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Иванов Иван"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Логин *</label>
                <input
                  required
                  value={form.login}
                  onChange={(e) => set('login', e.target.value)}
                  placeholder="ivanov"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="user@csp.uz (необязательно)"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Телефон</label>
                  <input
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    placeholder="+998901234567"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Роль *</label>
                  <select
                    value={form.role}
                    onChange={(e) => set('role', e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(roleLabels).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Пароль</label>
                <input
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">По умолчанию: password123</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 min-h-11 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Создание...' : 'Создать'}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="flex-1 min-h-11 border py-2 rounded-lg text-sm hover:bg-gray-50">
                  Отмена
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}

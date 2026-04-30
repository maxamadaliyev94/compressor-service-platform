'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'ENGINEER', password: 'password123' })

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setLoading(false)
    setOpen(false)
    setForm({ name: '', email: '', phone: '', role: 'ENGINEER', password: 'password123' })
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
        + Добавить пользователя
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-4">Новый пользователь</h2>
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
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="user@csp.uz"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
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
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Создание...' : 'Создать'}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="flex-1 border py-2 rounded-lg text-sm hover:bg-gray-50">
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AddBranchButton({ clientId }: { clientId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', address: '', contactPerson: '',
    phone: '', workingHours: ''
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/branches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, clientId })
    })
    setLoading(false)
    setOpen(false)
    setForm({ name: '', address: '', contactPerson: '', phone: '', workingHours: '' })
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-blue-700">
        + Добавить филиал
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-4">Новый филиал</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Название *</label>
                <input required value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="Главный завод, Производство №2..."
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Адрес</label>
                <input value={form.address} onChange={e => set('address', e.target.value)}
                  placeholder="г. Ташкент, ул. Примерная 1"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Контактное лицо</label>
                  <input value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)}
                    placeholder="Иванов Иван"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Телефон</label>
                  <input value={form.phone} onChange={e => set('phone', e.target.value)}
                    placeholder="+998901234567"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Режим работы</label>
                <input value={form.workingHours} onChange={e => set('workingHours', e.target.value)}
                  placeholder="24/7 или 08:00-18:00"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Создание...' : 'Добавить'}
                </button>
                <button type="button" onClick={() => setOpen(false)}
                  className="flex-1 border py-2 rounded-lg text-sm hover:bg-gray-50">
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

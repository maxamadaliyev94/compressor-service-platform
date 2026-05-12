'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CitySelect } from '@/components/CitySelect'

export default function NewClientPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  /** Синхронная защита от двойного сабмита (двойной клик до перерисовки с loading) */
  const submitLock = useRef(false)
  const [form, setForm] = useState({
    name: '', inn: '', contactPerson: '',
    phone: '', email: '', status: 'STANDART',
    country: 'Узбекистан', city: '', comment: ''
  })

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitLock.current || loading) return
    submitLock.current = true
    setLoading(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.status === 403) {
        alert('Недостаточно прав для создания клиента')
        router.push('/403')
        return
      }
      if (!res.ok) {
        alert('Не удалось создать клиента')
        return
      }
      router.push('/clients')
      router.refresh()
    } finally {
      submitLock.current = false
      setLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="flex items-center gap-2 md:gap-3 mb-6">
        <a href="/clients" className="text-gray-400 hover:text-gray-600">
          ← Назад
        </a>
        <h1 className="text-2xl font-bold">Новый клиент</h1>
      </div>
      <form onSubmit={handleSubmit} className="bg-white border rounded-xl p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1">Название компании *</label>
          <input required value={form.name} onChange={e => set('name', e.target.value)}
            placeholder='ООО "Ташкент Текстиль"'
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Страна</label>
            <input value={form.country} onChange={e => set('country', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Город *</label>
            <CitySelect
              required
              value={form.city}
              onChange={(v) => set('city', v)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">ИНН</label>
            <input value={form.inn} onChange={e => set('inn', e.target.value)}
              placeholder="123456789"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Статус</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="VIP">⭐ VIP</option>
              <option value="STANDART">Стандарт</option>
              <option value="PASSIVE">Пассивный</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Контактное лицо</label>
          <input value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)}
            placeholder="Юсупов Акбар"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Телефон</label>
            <input value={form.phone} onChange={e => set('phone', e.target.value)}
              placeholder="+998901234567"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
              placeholder="info@company.uz"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Комментарий</label>
          <textarea value={form.comment} onChange={e => set('comment', e.target.value)}
            rows={3} placeholder="Особенности, режим работы, договорённости..."
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Сохранение...' : 'Создать клиента'}
          </button>
          <a href="/clients" className="px-6 py-2 rounded-lg text-sm border hover:bg-gray-50">Отмена</a>
        </div>
      </form>
    </div>
  )
}

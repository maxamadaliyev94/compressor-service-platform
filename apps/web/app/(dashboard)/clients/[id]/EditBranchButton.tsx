'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

function yandexRouteUrl(latStr: string, lngStr: string): string | null {
  const lat = parseFloat(latStr.replace(',', '.'))
  const lng = parseFloat(lngStr.replace(',', '.'))
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return `https://yandex.ru/maps/?mode=routes&rtext=~${lat},${lng}&rtt=auto`
}

export type EditableBranch = {
  id: string
  name: string
  address: string | null
  contactPerson: string | null
  phone: string | null
  workingHours: string | null
  latitude: number | null
  longitude: number | null
}

export default function EditBranchButton({ branch }: { branch: EditableBranch }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [detectingLocation, setDetectingLocation] = useState(false)
  const [gpsJustAdded, setGpsJustAdded] = useState(false)
  const [highlightCoords, setHighlightCoords] = useState(false)
  const [form, setForm] = useState({
    name: branch.name,
    address: branch.address ?? '',
    contactPerson: branch.contactPerson ?? '',
    phone: branch.phone ?? '',
    workingHours: branch.workingHours ?? '',
    latitude: branch.latitude != null ? String(branch.latitude) : '',
    longitude: branch.longitude != null ? String(branch.longitude) : '',
  })

  function set(field: keyof typeof form, value: string) {
    if (field === 'latitude' || field === 'longitude') setGpsJustAdded(false)
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const routeHref = useMemo(
    () => yandexRouteUrl(form.latitude.trim(), form.longitude.trim()),
    [form.latitude, form.longitude]
  )

  useEffect(() => {
    if (!gpsJustAdded) return
    setHighlightCoords(true)
    const t = window.setTimeout(() => setHighlightCoords(false), 3500)
    return () => window.clearTimeout(t)
  }, [gpsJustAdded])

  function addLocationFromGps() {
    if (!navigator.geolocation) {
      alert('Геолокация не поддерживается в этом браузере')
      return
    }
    setDetectingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }))
        setDetectingLocation(false)
        setGpsJustAdded(true)
      },
      () => {
        alert('Не удалось получить координаты. Разрешите доступ к геолокации или введите широту и долготу вручную.')
        setDetectingLocation(false)
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  function openModal() {
    setForm({
      name: branch.name,
      address: branch.address ?? '',
      contactPerson: branch.contactPerson ?? '',
      phone: branch.phone ?? '',
      workingHours: branch.workingHours ?? '',
      latitude: branch.latitude != null ? String(branch.latitude) : '',
      longitude: branch.longitude != null ? String(branch.longitude) : '',
    })
    setGpsJustAdded(false)
    setHighlightCoords(false)
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = form.name.trim()
    if (!name) {
      alert('Укажите название филиала')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/branches/${branch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          address: form.address.trim() || null,
          contactPerson: form.contactPerson.trim() || null,
          phone: form.phone.trim() || null,
          workingHours: form.workingHours.trim() || null,
          latitude: form.latitude.trim() === '' ? null : form.latitude.trim(),
          longitude: form.longitude.trim() === '' ? null : form.longitude.trim(),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert((data as { error?: string }).error ?? 'Не удалось сохранить')
        return
      }
      setOpen(false)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => openModal()}
        className="text-xs text-blue-600 hover:text-blue-800 hover:underline px-1 py-0.5 rounded"
        title="Редактировать филиал"
      >
        Изменить
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">Редактировать филиал</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Название *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Главный завод, Производство №2..."
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Адрес</label>
                <input
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                  placeholder="г. Ташкент, ул. Примерная 1"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span className="text-sm font-medium text-gray-800">Локация на карте</span>
                  <button
                    type="button"
                    onClick={() => addLocationFromGps()}
                    disabled={detectingLocation}
                    className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-500 bg-white px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                  >
                    <span aria-hidden>📍</span>
                    {detectingLocation ? 'Определяем…' : 'Добавить локацию'}
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Подставляет текущие GPS-координаты устройства в поля ниже (удобно на площадке клиента). Либо введите широту и долготу вручную.
                </p>
                {gpsJustAdded && (
                  <div
                    role="status"
                    className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900"
                  >
                    <span className="text-green-600 shrink-0" aria-hidden>
                      ✓
                    </span>
                    <span>
                      <strong>Локация получена.</strong> Координаты подставлены в поля ниже. Проверьте точку на карте кнопкой «Маршрут» и нажмите{' '}
                      <strong>Сохранить</strong>, чтобы записать их в базу.
                    </span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Широта</label>
                  <input
                    value={form.latitude}
                    onChange={(e) => set('latitude', e.target.value)}
                    placeholder="41.311081"
                    inputMode="decimal"
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow ${
                      highlightCoords ? 'ring-2 ring-green-400 border-green-400 bg-green-50/50' : ''
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Долгота</label>
                  <input
                    value={form.longitude}
                    onChange={(e) => set('longitude', e.target.value)}
                    placeholder="69.279737"
                    inputMode="decimal"
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow ${
                      highlightCoords ? 'ring-2 ring-green-400 border-green-400 bg-green-50/50' : ''
                    }`}
                  />
                </div>
              </div>
              {routeHref ? (
                <a
                  href={routeHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
                >
                  <span aria-hidden>🚗</span>
                  Построить маршрут в Яндекс.Картах
                </a>
              ) : (
                <p className="text-xs text-gray-400 text-center">Введите широту и долготу — станет доступна кнопка маршрута</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Контактное лицо</label>
                  <input
                    value={form.contactPerson}
                    onChange={(e) => set('contactPerson', e.target.value)}
                    placeholder="Иванов Иван"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Телефон</label>
                  <input
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    placeholder="+998901234567"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Режим работы</label>
                <input
                  value={form.workingHours}
                  onChange={(e) => set('workingHours', e.target.value)}
                  placeholder="24/7 или 08:00-18:00"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 border py-2 rounded-lg text-sm hover:bg-gray-50"
                >
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

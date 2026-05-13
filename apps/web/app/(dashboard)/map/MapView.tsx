'use client'
import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'

const YandexMap = dynamic(() => import('./YandexMap'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#9ca3af' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🗺️</div>
        <div>Загрузка карты...</div>
      </div>
    </div>
  ),
})

const STATUS_COLORS: Record<string, string> = {
  VIP: '#a855f7', STANDART: '#3b82f6',
  PASSIVE: '#9ca3af',
}
const STATUS_LABELS: Record<string, string> = {
  VIP: 'VIP', STANDART: 'Стандарт',
  PASSIVE: 'Пассивный',
}

export default function MapView({
  cityData,
  clients,
  branchPoints,
  yandexMapsApiKey,
}: {
  cityData: any[]
  clients: any[]
  branchPoints: any[]
  yandexMapsApiKey: string
}) {
  const [selected, setSelected] = useState<any>(null)
  const [selectedCity, setSelectedCity] = useState<string>('ALL')
  const maxClients = Math.max(...cityData.map((c: any) => c.total), 1)
  void clients
  const filteredBranchPoints =
    selectedCity === 'ALL' ? branchPoints : branchPoints.filter((point: any) => point.city === selectedCity)

  const handleMapCityClick = useCallback((data: any) => {
    setSelected(data)
    setSelectedCity(data?.city || 'ALL')
  }, [])

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">
      <div className="xl:col-span-2">
        <div className="bg-white border rounded-xl overflow-hidden h-[360px] sm:h-[420px] md:h-[560px]">
          <YandexMap
            apiKey={yandexMapsApiKey}
            cityData={cityData}
            branchPoints={filteredBranchPoints}
            onCityClick={handleMapCityClick}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">
          Карта Яндекса — зум и перемещение; круги городов и маркеры филиалов. Нажмите на объект для деталей.
        </p>
      </div>

      <div className="space-y-4">
        <div className="bg-white border rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-1">
            Города ({cityData.length})
          </h3>
          <p className="text-xs text-gray-500 mb-3 leading-relaxed">
            Подсчёт по площадкам: если у филиала заданы координаты, город определяется по карте; иначе — по полю «Город» в
            карточке клиента. Синие круги — справочные центры городов, метки — точные филиалы.
          </p>
          <div className="space-y-2">
            <select
              value={selectedCity}
              onChange={(e) => {
                const value = e.target.value
                setSelectedCity(value)
                setSelected(value === 'ALL' ? null : cityData.find((c: any) => c.city === value) || null)
              }}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Все города</option>
              {[...cityData]
                .sort((a: any, b: any) => a.city.localeCompare(b.city, 'ru'))
                .map((data: any) => (
                  <option key={data.city} value={data.city}>
                    {data.city}
                  </option>
                ))}
            </select>
            {cityData
              .sort((a: any, b: any) => b.total - a.total)
              .map((data: any) => {
                const items: {
                  equipmentId: string
                  clientName: string
                  brand: string
                  model: string
                  serialNumber: string
                }[] = [...(data.equipmentItems || [])].sort((x, y) =>
                  x.clientName.localeCompare(y.clientName, 'ru') || x.serialNumber.localeCompare(y.serialNumber, 'ru')
                )
                return (
                  <div
                    key={data.city}
                    className={`rounded-lg border transition-colors ${
                      selected?.city === data.city ? 'bg-blue-50 border-blue-200' : 'border-gray-100 bg-white hover:border-gray-200'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        const isSame = selected?.city === data.city
                        setSelected(isSame ? null : data)
                        setSelectedCity(isSame ? 'ALL' : data.city)
                      }}
                      className="w-full flex items-center justify-between p-2.5 text-left"
                    >
                      <div>
                        <div className="text-sm font-medium">{data.city}</div>
                        <div className="text-xs text-gray-500">
                          {data.equipment} ед. · {data.total} {data.total === 1 ? 'клиент' : 'клиентов'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-16 bg-gray-100 rounded-full h-1.5">
                          <div
                            className="bg-blue-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${(data.total / maxClients) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-blue-700 w-4 text-right">{data.total}</span>
                      </div>
                    </button>
                    {items.length > 0 && (
                      <ul className="px-2.5 pb-2.5 max-h-48 overflow-y-auto space-y-1.5 border-t border-gray-100/80 pt-2">
                        {items.map((eq) => (
                          <li key={`${data.city}-${eq.equipmentId}`} className="text-[11px] leading-snug text-gray-700 pl-1">
                            <span className="font-medium text-gray-800">{eq.clientName}</span>
                            <span className="text-gray-400"> — </span>
                            <a
                              href={`/equipment/${eq.equipmentId}`}
                              className="text-blue-600 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {eq.brand} {eq.model}
                            </a>
                            <div className="text-gray-500 mt-0.5">№ {eq.serialNumber}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
          </div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-1">Точные локации площадок</h3>
          <p className="text-xs text-gray-500">
            На карте отображаются маркеры площадок с координатами: {filteredBranchPoints.length}
          </p>
        </div>

        {selected ? (
          <div className="bg-white border rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-sm">📍 {selected.city}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <div className="flex gap-3 mb-3">
              <div className="bg-blue-50 rounded-lg p-2 text-center flex-1">
                <div className="text-xl font-bold text-blue-700">{selected.total}</div>
                <div className="text-xs text-blue-500">клиентов</div>
              </div>
              <div className="bg-green-50 rounded-lg p-2 text-center flex-1">
                <div className="text-xl font-bold text-green-700">{selected.equipment}</div>
                <div className="text-xs text-green-500">оборудования</div>
              </div>
            </div>
            {Array.isArray(selected.equipmentItems) && selected.equipmentItems.length > 0 && (
              <div className="mb-3 border border-gray-100 rounded-lg p-2 max-h-52 overflow-y-auto">
                <div className="text-xs font-semibold text-gray-700 mb-2">Оборудование в городе</div>
                <ul className="space-y-2">
                  {[...selected.equipmentItems]
                    .sort((a: any, b: any) =>
                      a.clientName.localeCompare(b.clientName, 'ru') || a.serialNumber.localeCompare(b.serialNumber, 'ru')
                    )
                    .map((eq: any) => (
                      <li key={eq.equipmentId} className="text-xs text-gray-700 border-b border-gray-50 last:border-0 pb-2 last:pb-0">
                        <div className="font-medium text-gray-800">{eq.clientName}</div>
                        <a href={`/equipment/${eq.equipmentId}`} className="text-blue-600 hover:underline">
                          {eq.brand} {eq.model}
                        </a>
                        <div className="text-gray-500">№ {eq.serialNumber}</div>
                      </li>
                    ))}
                </ul>
              </div>
            )}
            <div className="space-y-2">
              {selected.clients.map((client: any) => {
                const equipCount = client.branches
                  .flatMap((b: any) => b.objects)
                  .flatMap((o: any) => o.equipment).length
                return (
                  <a key={client.id} href={`/clients/${client.id}`}
                    className="block p-2.5 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{client.name}</div>
                        {client.contactPerson && (
                          <div className="text-xs text-gray-500">{client.contactPerson}</div>
                        )}
                        {client.phone && (
                          <div className="text-xs text-gray-400">{client.phone}</div>
                        )}
                      </div>
                      <div className="text-right ml-2 flex-shrink-0">
                        <div className="text-xs font-bold">{equipCount} ед.</div>
                        <div className="text-xs mt-0.5 px-1.5 py-0.5 rounded-full inline-block"
                          style={{ backgroundColor: STATUS_COLORS[client.status] + '20', color: STATUS_COLORS[client.status] }}>
                          {STATUS_LABELS[client.status]}
                        </div>
                      </div>
                    </div>
                  </a>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 text-center">
            <div className="text-3xl mb-2">🗺️</div>
            <p className="text-sm text-blue-700 font-medium">Нажмите на маркер</p>
            <p className="text-xs text-blue-500 mt-1">на карте или выберите город из списка</p>
          </div>
        )}
      </div>
    </div>
  )
}

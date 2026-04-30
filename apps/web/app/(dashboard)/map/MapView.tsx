'use client'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#9ca3af' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🗺️</div>
        <div>Загрузка карты...</div>
      </div>
    </div>
  )
})

const STATUS_COLORS: Record<string, string> = {
  VIP: '#a855f7', STANDART: '#3b82f6',
  PASSIVE: '#9ca3af',
}
const STATUS_LABELS: Record<string, string> = {
  VIP: 'VIP', STANDART: 'Стандарт',
  PASSIVE: 'Пассивный',
}

export default function MapView({ cityData, clients }: { cityData: any[], clients: any[] }) {
  const [selected, setSelected] = useState<any>(null)
  const maxClients = Math.max(...cityData.map((c: any) => c.total), 1)
  void clients

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2">
        <div className="bg-white border rounded-xl overflow-hidden" style={{ height: '560px' }}>
          <LeafletMap cityData={cityData} onCityClick={setSelected} />
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">
          Карта интерактивна — можно зумировать и перемещать. Нажмите на маркер для деталей.
        </p>
      </div>

      <div className="space-y-4">
        <div className="bg-white border rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3">
            Города ({cityData.length})
          </h3>
          <div className="space-y-2">
            {cityData.sort((a: any, b: any) => b.total - a.total).map((data: any) => (
              <button key={data.city}
                onClick={() => setSelected(selected?.city === data.city ? null : data)}
                className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-colors ${selected?.city === data.city ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}`}>
                <div>
                  <div className="text-sm font-medium">{data.city}</div>
                  <div className="text-xs text-gray-500">{data.equipment} ед. оборудования</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-gray-100 rounded-full h-1.5">
                    <div className="bg-blue-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${(data.total / maxClients) * 100}%` }}/>
                  </div>
                  <span className="text-sm font-bold text-blue-700 w-4 text-right">{data.total}</span>
                </div>
              </button>
            ))}
          </div>
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

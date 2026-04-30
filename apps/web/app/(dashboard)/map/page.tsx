import { db } from '@/lib/db'
import MapView from './MapView'

export default async function MapPage() {
  const clients = await db.client.findMany({
    include: {
      branches: {
        include: { objects: { include: { equipment: true } } }
      }
    }
  })

  const cityData = clients.reduce((acc: any, client) => {
    const city = client.city || 'Не указан'
    if (!acc[city]) acc[city] = { city, clients: [], total: 0, equipment: 0 }
    acc[city].clients.push(client)
    acc[city].total++
    acc[city].equipment += client.branches.flatMap(b => b.objects).flatMap(o => o.equipment).length
    return acc
  }, {})

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Карта клиентов</h1>
        <p className="text-sm text-gray-500 mt-1">Узбекистан — распределение по городам</p>
      </div>
      <MapView cityData={Object.values(cityData)} clients={clients} />
    </div>
  )
}

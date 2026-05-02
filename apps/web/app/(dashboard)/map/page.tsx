import { db } from '@/lib/db'
import { nearestMapCityName, parseBranchCoords } from '@/lib/mapCities'
import MapView from './MapView'

export default async function MapPage() {
  const clients = await db.client.findMany({
    include: {
      branches: {
        include: { objects: { include: { equipment: true } } },
      },
    },
  })

  type CityBucket = {
    city: string
    clients: (typeof clients)[number][]
    total: number
    equipment: number
  }
  const cityMap: Record<string, CityBucket> = {}

  for (const client of clients) {
    if (client.branches.length === 0) {
      const cityKey = client.city?.trim() || 'Не указан'
      if (!cityMap[cityKey]) {
        cityMap[cityKey] = { city: cityKey, clients: [], total: 0, equipment: 0 }
      }
      if (!cityMap[cityKey].clients.find((c) => c.id === client.id)) {
        cityMap[cityKey].clients.push(client)
        cityMap[cityKey].total++
      }
      continue
    }

    for (const branch of client.branches) {
      const branchEquip = branch.objects.flatMap((o) => o.equipment).length
      const coords = parseBranchCoords(branch.latitude, branch.longitude)
      const cityKey = coords
        ? nearestMapCityName(coords.lat, coords.lng)
        : client.city?.trim() || 'Не указан'

      if (!cityMap[cityKey]) {
        cityMap[cityKey] = { city: cityKey, clients: [], total: 0, equipment: 0 }
      }
      cityMap[cityKey].equipment += branchEquip
      if (!cityMap[cityKey].clients.find((c) => c.id === client.id)) {
        cityMap[cityKey].clients.push(client)
        cityMap[cityKey].total++
      }
    }
  }

  const cityData = Object.values(cityMap)

  const branchPoints = clients.flatMap((client) =>
    client.branches
      .map((branch) => {
        const c = parseBranchCoords(branch.latitude, branch.longitude)
        if (!c) return null
        return {
          id: branch.id,
          name: branch.name,
          address: branch.address,
          latitude: c.lat,
          longitude: c.lng,
          clientId: client.id,
          clientName: client.name,
          city: client.city || 'Не указан',
          equipmentCount: branch.objects.flatMap((o) => o.equipment).length,
        }
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
  )

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Карта клиентов</h1>
        <p className="text-sm text-gray-500 mt-1">Узбекистан — филиалы с координатами и города по геолокации / карточке клиента</p>
      </div>
      <MapView cityData={cityData} clients={clients} branchPoints={branchPoints} />
    </div>
  )
}

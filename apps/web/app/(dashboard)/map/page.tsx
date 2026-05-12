import { db } from '@/lib/db'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { nearestMapCityName, parseBranchCoords } from '@/lib/mapCities'
import MapView from './MapView'

export default async function MapPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const clients = await db.client.findMany({
    where: {},
    include: {
      branches: {
        include: { objects: { include: { equipment: true } } },
      },
    },
  })

  type CityEquipRow = {
    equipmentId: string
    clientName: string
    brand: string
    model: string
    serialNumber: string
  }

  type CityBucket = {
    city: string
    clients: (typeof clients)[number][]
    total: number
    equipment: number
    equipmentItems: CityEquipRow[]
  }
  const cityMap: Record<string, CityBucket> = {}

  for (const client of clients) {
    if (client.branches.length === 0) {
      const cityKey = client.city?.trim() || 'Не указан'
      if (!cityMap[cityKey]) {
        cityMap[cityKey] = { city: cityKey, clients: [], total: 0, equipment: 0, equipmentItems: [] }
      }
      if (!cityMap[cityKey].clients.find((c) => c.id === client.id)) {
        cityMap[cityKey].clients.push(client)
        cityMap[cityKey].total++
      }
      continue
    }

    for (const branch of client.branches) {
      const branchEquipment = branch.objects.flatMap((o) => o.equipment)
      const branchEquip = branchEquipment.length
      const coords = parseBranchCoords(branch.latitude, branch.longitude)
      const cityKey = coords
        ? nearestMapCityName(coords.lat, coords.lng)
        : client.city?.trim() || 'Не указан'

      if (!cityMap[cityKey]) {
        cityMap[cityKey] = { city: cityKey, clients: [], total: 0, equipment: 0, equipmentItems: [] }
      }
      cityMap[cityKey].equipment += branchEquip
      for (const eq of branchEquipment) {
        cityMap[cityKey].equipmentItems.push({
          equipmentId: eq.id,
          clientName: client.name,
          brand: eq.brand,
          model: eq.model,
          serialNumber: eq.serialNumber,
        })
      }
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
        const equipment = branch.objects.flatMap((o) => o.equipment)
        return {
          id: branch.id,
          name: branch.name,
          address: branch.address,
          latitude: c.lat,
          longitude: c.lng,
          clientId: client.id,
          clientName: client.name,
          city: client.city || 'Не указан',
          equipmentCount: equipment.length,
          equipment: equipment.map((eq) => ({
            id: eq.id,
            brand: eq.brand,
            model: eq.model,
            serialNumber: eq.serialNumber,
            type: eq.type,
          })),
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

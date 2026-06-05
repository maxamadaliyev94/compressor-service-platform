import { db } from '@/lib/db'
import { auth } from '@/auth'
import ReferencesClient from './ReferencesClient'

export default async function ReferencesPage() {
  const session = await auth()
  const role = session?.user?.role
  const isAdmin = role === 'ADMIN'
  const canManageRegulations = role === 'ADMIN' || role === 'MANAGER'

  const [equipmentTypes, brands, regulations, cities, workTypes] = await Promise.all([
    db.equipmentTypeRef.findMany({
      where: { isActive: true },
      orderBy: [{ isSystem: 'desc' }, { nameRu: 'asc' }]
    }),
    db.equipmentBrandRef.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    }),
    db.maintenanceRegulation.findMany({
      where: { isActive: true },
      include: { items: { orderBy: { order: 'asc' } } },
      orderBy: { name: 'asc' }
    }),
    db.city.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    db.workTypeRef.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { nameRu: 'asc' }],
    }),
  ])

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Справочники</h1>
        <p className="text-sm text-gray-500 mt-1">
          Типы оборудования, бренды, города, типы работ и чек-листы для быстрых и долгосрочных задач
        </p>
      </div>
      <ReferencesClient
        initialTypes={equipmentTypes}
        initialBrands={brands}
        initialRegulations={regulations}
        initialCities={cities}
        initialWorkTypes={workTypes}
        isAdmin={isAdmin}
        canManageRegulations={canManageRegulations}
      />
    </div>
  )
}

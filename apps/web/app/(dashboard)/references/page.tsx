import { db } from '@/lib/db'
import { auth } from '@/auth'
import ReferencesClient from './ReferencesClient'

export default async function ReferencesPage() {
  const session = await auth()
  const isAdmin = session?.user?.role === 'ADMIN'

  const [equipmentTypes, brands, regulations] = await Promise.all([
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
    })
  ])

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Справочники</h1>
        <p className="text-sm text-gray-500 mt-1">
          Управляйте типами и брендами — они появятся в форме добавления оборудования
        </p>
      </div>
      <ReferencesClient
        initialTypes={equipmentTypes}
        initialBrands={brands}
        initialRegulations={regulations}
        isAdmin={isAdmin}
      />
    </div>
  )
}

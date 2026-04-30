import { auth } from '@/auth'
import { db } from '@/lib/db'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const session = await auth()
  const isAdmin = session?.user?.role === 'ADMIN'

  const equipmentTypes = await db.maintenanceRegulation.findMany({
    where: { isActive: true },
    orderBy: { equipmentType: 'asc' },
  })

  const brands = await db.equipmentBrandRef.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' }
  })

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Настройки</h1>
        <p className="text-sm text-gray-500 mt-1">Справочники и служебные параметры системы</p>
      </div>
      <SettingsClient equipmentTypes={equipmentTypes} brands={brands} isAdmin={isAdmin} />
    </div>
  )
}

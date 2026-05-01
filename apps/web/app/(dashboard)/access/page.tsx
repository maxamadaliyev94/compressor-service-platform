import { requirePermission } from '@/lib/permissions'
import AccessMatrixClient from './AccessMatrixClient'

export default async function AccessPage() {
  await requirePermission('action:user.manage')

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Управление доступом</h1>
        <p className="text-sm text-gray-500 mt-1">
          Настройка разделов, действий и видимости полей для ролей
        </p>
      </div>
      <AccessMatrixClient />
    </div>
  )
}

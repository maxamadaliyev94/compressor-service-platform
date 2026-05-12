import { db } from '@/lib/db'
import { SuperadminToggle } from './SuperadminToggle'

export const dynamic = 'force-dynamic'

export default async function SuperadminPage() {
  const settings = await db.appSettings.findUnique({ where: { id: 'default' } })
  const initialActive = settings?.isActive !== false

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 px-4 py-12">
      <div className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm space-y-2">
        <h1 className="text-lg font-semibold text-gray-900">Управление доступностью</h1>
        <p className="text-sm text-gray-500 pb-4">
          Отдельная зона владельца: не связана с учётными записями приложения.
        </p>
        <SuperadminToggle initialActive={initialActive} />
      </div>
    </div>
  )
}

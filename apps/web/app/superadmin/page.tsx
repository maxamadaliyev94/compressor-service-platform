import { computeGloballyAccessible, subscriptionDaysRemainingInclusive } from '@/lib/access-policy'
import { db } from '@/lib/db'
import { SuperadminPanel } from './SuperadminPanel'

export const dynamic = 'force-dynamic'

export default async function SuperadminPage() {
  const settings = await db.appSettings.findUnique({ where: { id: 'default' } })
  const initialActive = settings?.isActive !== false
  const globallyAccessible = computeGloballyAccessible(
    settings
      ? { isActive: settings.isActive, subscriptionEnd: settings.subscriptionEnd }
      : null,
  )

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 px-4 py-12">
      <div className="w-full max-w-lg rounded-xl border bg-white p-8 shadow-sm space-y-2">
        <h1 className="text-lg font-semibold text-gray-900">Управление доступностью</h1>
        <p className="text-sm text-gray-500 pb-4">
          Отдельная зона владельца: не связана с учётными записями приложения.
        </p>
        <SuperadminPanel
          initialActive={initialActive}
          initialGloballyAccessible={globallyAccessible}
          initialSubscriptionStart={settings?.subscriptionStart ?? null}
          initialSubscriptionEnd={settings?.subscriptionEnd ?? null}
        />
      </div>
    </div>
  )
}

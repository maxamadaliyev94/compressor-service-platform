import { computeGloballyAccessible } from '@/lib/access-policy'
import { db } from '@/lib/db'
import { computeMaintenanceState } from '@/lib/maintenance-policy'
import { SuperadminMaintenanceSection } from './SuperadminMaintenanceSection'
import { SuperadminPanel } from './SuperadminPanel'
import { SuperadminUserHistoryPanel } from './SuperadminUserHistoryPanel'

export const dynamic = 'force-dynamic'

export default async function SuperadminPage() {
  const settings = await db.appSettings.findUnique({ where: { id: 'default' } })
  const initialActive = settings?.isActive !== false
  const globallyAccessible = computeGloballyAccessible(
    settings
      ? { isActive: settings.isActive, subscriptionEnd: settings.subscriptionEnd }
      : null,
  )

  const maintenance = computeMaintenanceState(
    new Date(),
    settings
      ? {
          maintenanceStart: settings.maintenanceStart,
          maintenanceEnd: settings.maintenanceEnd,
          maintenanceMessage: settings.maintenanceMessage,
        }
      : null,
  )

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 px-4 py-12">
      <div className="w-full max-w-6xl grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border bg-white p-8 shadow-sm space-y-2">
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

        <div className="rounded-xl border bg-white p-8 shadow-sm space-y-2">
          <h1 className="text-lg font-semibold text-gray-900">Технические работы</h1>
          <p className="text-sm text-gray-500 pb-4">
            Плановое окно: баннеры до начала, полная блокировка на время интервала.
          </p>
          {maintenance.phase !== 'none' ? (
            <div className="rounded-lg border bg-amber-50 px-3 py-2 text-xs text-amber-950 mb-2">
              Сейчас действует план технических работ (
              {maintenance.phase === 'announce'
                ? 'показ баннера до начала'
                : maintenance.phase === 'warning'
                  ? 'предупреждение за 30 минут'
                  : 'полная блокировка для пользователей'}
              ). После окончания окна доступ восстанавливается автоматически.
            </div>
          ) : null}
          <SuperadminMaintenanceSection
            initialStart={settings?.maintenanceStart ?? null}
            initialEnd={settings?.maintenanceEnd ?? null}
            initialMessage={settings?.maintenanceMessage ?? null}
          />
        </div>

        <div className="md:col-span-2 rounded-xl border bg-white p-8 shadow-sm space-y-2">
          <h1 className="text-lg font-semibold text-gray-900">История активности пользователей</h1>
          <p className="text-sm text-gray-500 pb-4">
            Журнал действий, сессии, статистика и управление доступом (только HTTP Basic этой зоны).
          </p>
          <SuperadminUserHistoryPanel />
        </div>
      </div>
    </div>
  )
}

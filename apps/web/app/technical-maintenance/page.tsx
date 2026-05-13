import { APP_TIMEZONE, formatTimeHHMM } from '@/lib/app-timezone'
import { db } from '@/lib/db'
import { computeMaintenanceState } from '@/lib/maintenance-policy'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function TechnicalMaintenancePage() {
  const row = await db.appSettings.findUnique({ where: { id: 'default' } })
  const state = computeMaintenanceState(new Date(), row)
  if (state.phase !== 'blocked') {
    redirect('/')
  }
  const endLabel = state.end ? formatTimeHHMM(state.end, APP_TIMEZONE) : '—'
  const msg = state.message?.trim()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      <div className="max-w-lg text-center space-y-3">
        <p className="text-base text-slate-800 leading-relaxed">
          Технические работы.
          {msg ? <> {msg}</> : null} Ожидаемое время окончания: {endLabel}
        </p>
      </div>
    </div>
  )
}

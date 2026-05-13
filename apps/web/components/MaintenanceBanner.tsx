'use client'

import { APP_TIMEZONE, formatTimeHHMM } from '@/lib/app-timezone'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

type MaintenancePayload = {
  phase: 'none' | 'announce' | 'warning' | 'blocked'
  message: string | null
  start: string | null
  end: string | null
}

async function fetchMaintenance(): Promise<MaintenancePayload | null> {
  try {
    const res = await fetch(`/api/internal/app-status?t=${Date.now()}`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
      body: '{}',
    })
    if (!res.ok) return null
    const data = (await res.json()) as { maintenance?: MaintenancePayload }
    return data.maintenance ?? null
  } catch {
    return null
  }
}

export function MaintenanceBanner() {
  const pathname = usePathname()
  const [m, setM] = useState<MaintenancePayload | null>(null)

  const refresh = useCallback(async () => {
    const next = await fetchMaintenance()
    setM(next)
  }, [])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh(), 45_000)
    return () => window.clearInterval(id)
  }, [refresh])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [refresh])

  if (!m || m.phase === 'none' || m.phase === 'blocked') return null
  if (pathname === '/technical-maintenance' || pathname?.startsWith('/superadmin')) return null

  const start = m.start ? new Date(m.start) : null
  const end = m.end ? new Date(m.end) : null
  const t0 = start ? formatTimeHHMM(start, APP_TIMEZONE) : '—'
  const t1 = end ? formatTimeHHMM(end, APP_TIMEZONE) : '—'
  const tail = m.message ? ` ${m.message}` : ''

  if (m.phase === 'announce') {
    return (
      <div
        role="status"
        className="sticky top-0 z-[100] bg-amber-100 text-amber-950 text-center text-sm px-3 py-2 border-b border-amber-200 shadow-sm"
      >
        Технические работы с {t0} до {t1}.{tail}
      </div>
    )
  }

  return (
    <div
      role="alert"
      className="sticky top-0 z-[100] bg-orange-100 text-orange-950 text-center text-sm px-3 py-2 border-b border-orange-200 shadow-sm space-y-0.5"
    >
      <div className="font-medium">Через 30 минут начнутся технические работы. Сохраните данные.</div>
      <div className="text-xs opacity-90">
        Окно: {t0} — {t1}.{tail}
      </div>
    </div>
  )
}

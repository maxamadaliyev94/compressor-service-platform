'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useRef } from 'react'

/** Первая загрузка после входа — сессия и LOGIN в журнале; периодически продлеваем lastSeen. */
export function UserSessionTracker() {
  const { status } = useSession()
  const bootOnce = useRef(false)

  useEffect(() => {
    if (status !== 'authenticated') return
    if (bootOnce.current) return
    bootOnce.current = true
    void fetch('/api/activity/bootstrap', { method: 'POST' }).catch(() => {})
  }, [status])

  useEffect(() => {
    if (status !== 'authenticated') return
    const id = window.setInterval(() => {
      void fetch('/api/activity/ping', { method: 'POST' }).catch(() => {})
    }, 120_000)
    return () => window.clearInterval(id)
  }, [status])

  return null
}

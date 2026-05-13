'use client'
import { MaintenanceBanner } from '@/components/MaintenanceBanner'
import { SessionProvider } from 'next-auth/react'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <MaintenanceBanner />
      {children}
    </SessionProvider>
  )
}

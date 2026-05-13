'use client'

import { signOut } from 'next-auth/react'

export function LogoutButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await fetch('/api/activity/session-end', { method: 'POST' })
        } catch {
          /* ignore */
        }
        await signOut({ callbackUrl: '/login' })
      }}
    >
      <span>→</span> Выйти
    </button>
  )
}

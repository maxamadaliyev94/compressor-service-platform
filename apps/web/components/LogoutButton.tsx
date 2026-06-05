'use client'

import type { ReactNode } from 'react'
import { signOut } from 'next-auth/react'

export function LogoutButton({
  className,
  icon,
}: {
  className?: string
  icon?: ReactNode
}) {
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
      {icon ?? <span aria-hidden>→</span>}
      Выйти
    </button>
  )
}

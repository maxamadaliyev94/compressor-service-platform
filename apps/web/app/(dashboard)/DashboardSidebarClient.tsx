'use client'

import { useState } from 'react'
import NotificationBell from '@/components/NotificationBell'

type NavItem = { href: string; label: string; icon: string }

export default function DashboardSidebarClient({
  navItems,
  userName,
  roleLabel,
  children,
  logoutAction,
}: {
  navItems: NavItem[]
  userName: string
  roleLabel: string
  children: React.ReactNode
  logoutAction: () => Promise<void>
}) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="md:flex md:h-screen bg-gray-50">
      <div className="md:hidden bg-white border-b sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="font-bold text-sm truncate">Compressor Service</h1>
            <p className="text-xs text-gray-500 truncate">{userName}</p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="min-h-11 min-w-11 inline-flex items-center justify-center border rounded-md text-gray-700"
              aria-label="Открыть меню"
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-label="Закрыть меню"
          />
          <aside className="absolute inset-y-0 left-0 w-[86%] max-w-xs bg-white border-r shadow-xl flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h2 className="font-bold text-sm">Compressor Service</h2>
                <p className="text-xs text-gray-500">Platform</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="min-h-11 min-w-11 inline-flex items-center justify-center border rounded-md text-gray-700"
                aria-label="Закрыть меню"
              >
                ×
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-3 py-3 rounded-md text-sm text-gray-700 hover:bg-gray-100"
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </a>
              ))}
            </nav>
            <div className="p-3 border-t">
              <div className="flex items-center gap-2 px-3 py-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <div className="text-xs font-medium text-gray-800 truncate">{userName}</div>
                  <div className="text-xs text-gray-400 truncate">{roleLabel}</div>
                </div>
              </div>
              <form action={logoutAction}>
                <button className="w-full min-h-11 text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 rounded-md flex items-center gap-2">
                  <span>→</span> Выйти
                </button>
              </form>
            </div>
          </aside>
        </div>
      )}

      <aside className="hidden md:flex w-56 bg-white border-r flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h1 className="font-bold text-sm">Compressor Service</h1>
            <p className="text-xs text-gray-500">Platform</p>
          </div>
          <NotificationBell />
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100"
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
        <div className="p-3 border-t">
          <div className="flex items-center gap-2 px-3 py-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-medium text-gray-800 truncate">{userName}</div>
              <div className="text-xs text-gray-400 truncate">{roleLabel}</div>
            </div>
          </div>
          <form action={logoutAction}>
            <button className="w-full text-left min-h-11 px-3 py-2 text-xs text-red-500 hover:bg-red-50 rounded-md flex items-center gap-2">
              <span>→</span> Выйти
            </button>
          </form>
        </div>
      </aside>
      <main className="w-full min-w-0 md:flex-1 overflow-auto">{children}</main>
    </div>
  )
}

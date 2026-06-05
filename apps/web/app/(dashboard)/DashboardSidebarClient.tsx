'use client'

import { type ChangeEvent, useRef, useState } from 'react'
import {
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  CheckSquare,
  Cog,
  History,
  ImageIcon,
  LayoutDashboard,
  Lock,
  LogOut,
  Map,
  Menu,
  MessageSquare,
  User,
  UserCog,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react'
import NotificationBell from '@/components/NotificationBell'
import ChatUnreadBadge from '@/components/ChatUnreadBadge'
import { LogoutButton } from '@/components/LogoutButton'

type NavItem = { href: string; label: string }

const NAV_ICONS: Record<string, LucideIcon> = {
  '/my-company': Building2,
  '/account': User,
  '/': LayoutDashboard,
  '/clients': Users,
  '/equipment': Cog,
  '/tasks': CheckSquare,
  '/chat': MessageSquare,
  '/engineers': Wrench,
  '/engineers/schedule': Calendar,
  '/history': History,
  '/reports': BarChart3,
  '/users': UserCog,
  '/access': Lock,
  '/map': Map,
  '/references': BookOpen,
}

const navLinkClass =
  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-blue-100/70 w-full min-h-[2.25rem]'

function NavIcon({ href }: { href: string }) {
  const Icon = NAV_ICONS[href] ?? LayoutDashboard
  return (
    <span className="w-5 h-5 shrink-0 flex items-center justify-center text-slate-600" aria-hidden>
      <Icon className="w-[1.125rem] h-[1.125rem]" strokeWidth={1.75} />
    </span>
  )
}

export default function DashboardSidebarClient({
  navItems,
  userName,
  roleLabel,
  userAvatarUrl,
  children,
}: {
  navItems: NavItem[]
  userName: string
  roleLabel: string
  userAvatarUrl: string | null
  children: React.ReactNode
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(userAvatarUrl)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function openAvatarPicker() {
    fileInputRef.current?.click()
  }

  async function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function onAvatarPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Можно загрузить только изображение')
      e.target.value = ''
      return
    }

    setUploadingAvatar(true)
    try {
      const dataUrl = await readFileAsDataUrl(file)
      const res = await fetch('/api/users/me/avatar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: dataUrl }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert((data as { error?: string }).error || 'Не удалось обновить аватар')
      } else {
        const data = (await res.json()) as { avatarUrl: string | null }
        setAvatarUrl(data.avatarUrl)
      }
    } catch {
      alert('Не удалось обработать файл')
    } finally {
      setUploadingAvatar(false)
      e.target.value = ''
    }
  }

  function renderNavItem(item: NavItem, onNavigate?: () => void) {
    if (item.href === '/chat') {
      return (
        <a key={item.href} href={item.href} className={navLinkClass} onClick={onNavigate}>
          <NavIcon href={item.href} />
          <span className="flex-1 min-w-0 truncate text-left">{item.label}</span>
          <ChatUnreadBadge />
        </a>
      )
    }
    return (
      <a key={item.href} href={item.href} className={navLinkClass} onClick={onNavigate}>
        <NavIcon href={item.href} />
        <span className="flex-1 min-w-0 truncate">{item.label}</span>
      </a>
    )
  }

  function renderAvatar(sizeClass: string, textClass: string) {
    if (avatarUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={userName}
          className={`${sizeClass} rounded-full object-cover border border-blue-100`}
        />
      )
    }
    return (
      <div
        className={`${sizeClass} rounded-full bg-blue-100 text-blue-700 flex items-center justify-center ${textClass} font-bold flex-shrink-0`}
      >
        {userName.charAt(0).toUpperCase()}
      </div>
    )
  }

  const footerBtnClass =
    'w-full min-h-11 text-left px-3 py-2 text-xs rounded-md flex items-center gap-3 disabled:opacity-50'

  return (
    <div className="md:flex md:h-screen bg-gray-50">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onAvatarPick}
        className="hidden"
      />
      <div className="md:hidden bg-sky-50 border-b border-sky-100 sticky top-0 z-40">
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
              className="min-h-11 min-w-11 inline-flex items-center justify-center border border-sky-200 rounded-md text-slate-600 hover:bg-blue-100/70"
              aria-label="Открыть меню"
            >
              <Menu className="w-5 h-5" strokeWidth={1.75} />
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
          <aside className="absolute inset-y-0 left-0 w-[86%] max-w-xs bg-sky-50 border-r border-sky-100 shadow-xl flex flex-col">
            <div className="p-4 border-b border-sky-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-sm">Compressor Service</h2>
                <p className="text-xs text-gray-500">Platform</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="min-h-11 min-w-11 inline-flex items-center justify-center border border-sky-200 rounded-md text-slate-600 hover:bg-blue-100/70"
                aria-label="Закрыть меню"
              >
                <X className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
              {navItems.map((item) => renderNavItem(item, () => setMobileOpen(false)))}
            </nav>
            <div className="p-3 border-t border-sky-100">
              <div className="flex items-center gap-2 px-3 py-2 mb-2">
                {renderAvatar('w-7 h-7', 'text-xs')}
                <div className="overflow-hidden min-w-0">
                  <div className="text-xs font-medium text-gray-800 truncate">{userName}</div>
                  <div className="text-xs text-gray-400 truncate">{roleLabel}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={openAvatarPicker}
                disabled={uploadingAvatar}
                className={`${footerBtnClass} text-blue-700 hover:bg-blue-100/70`}
              >
                <span className="w-5 h-5 shrink-0 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4" strokeWidth={1.75} />
                </span>
                {uploadingAvatar ? 'Загрузка...' : 'Сменить аватар'}
              </button>
              <LogoutButton
                className={`${footerBtnClass} text-red-600 hover:bg-red-50`}
                icon={<LogOut className="w-4 h-4 shrink-0" strokeWidth={1.75} />}
              />
            </div>
          </aside>
        </div>
      )}

      <aside className="hidden md:flex w-56 bg-sky-50 border-r border-sky-100 flex-col">
        <div className="p-4 border-b border-sky-100 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="font-bold text-sm leading-tight">Compressor Service</h1>
            <p className="text-xs text-gray-500">Platform</p>
          </div>
          <NotificationBell />
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => renderNavItem(item))}
        </nav>
        <div className="p-3 border-t border-sky-100">
          <div className="flex items-center gap-2 px-3 py-2 mb-1">
            {renderAvatar('w-7 h-7', 'text-xs')}
            <div className="overflow-hidden min-w-0">
              <div className="text-xs font-medium text-gray-800 truncate">{userName}</div>
              <div className="text-xs text-gray-400 truncate">{roleLabel}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={openAvatarPicker}
            disabled={uploadingAvatar}
            className={`${footerBtnClass} text-blue-700 hover:bg-blue-100/70`}
          >
            <span className="w-5 h-5 shrink-0 flex items-center justify-center">
              <ImageIcon className="w-4 h-4" strokeWidth={1.75} />
            </span>
            {uploadingAvatar ? 'Загрузка...' : 'Сменить аватар'}
          </button>
          <LogoutButton
            className={`${footerBtnClass} text-red-600 hover:bg-red-50`}
            icon={<LogOut className="w-4 h-4 shrink-0" strokeWidth={1.75} />}
          />
        </div>
      </aside>
      <main className="w-full min-w-0 md:flex-1 overflow-auto">{children}</main>
    </div>
  )
}

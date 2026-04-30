import { auth, signOut } from '@/auth'
import { redirect } from 'next/navigation'
import NotificationBell from '@/components/NotificationBell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  const roleLabels: Record<string, string> = {
    ADMIN: 'Администратор',
    MANAGER: 'Менеджер',
    CHIEF_ENGINEER: 'Главный инженер',
    ENGINEER: 'Инженер',
    CLIENT: 'Клиент',
  }

  const role = session.user.role as string

  const navItems = [
    { href: '/', label: 'Dashboard', icon: '▦', roles: ['ADMIN', 'MANAGER', 'CHIEF_ENGINEER'] },
    { href: '/clients', label: 'Клиенты', icon: '👥', roles: ['ADMIN', 'MANAGER'] },
    {
      href: '/equipment',
      label: 'Оборудование',
      icon: '⚙️',
      roles: ['ADMIN', 'MANAGER', 'CHIEF_ENGINEER', 'ENGINEER'],
    },
    {
      href: '/tasks',
      label: 'Задачи',
      icon: '✓',
      roles: ['ADMIN', 'MANAGER', 'CHIEF_ENGINEER', 'ENGINEER'],
    },
    { href: '/reports', label: 'Отчёты', icon: '📊', roles: ['ADMIN', 'MANAGER', 'CHIEF_ENGINEER'] },
    { href: '/users', label: 'Пользователи', icon: '👤', roles: ['ADMIN'] },
    { href: '/map', label: 'Карта', icon: '🗺️', roles: ['ADMIN', 'MANAGER', 'CHIEF_ENGINEER'] },
    { href: '/references', label: 'Справочники', icon: '📋', roles: ['ADMIN', 'MANAGER'] },
  ].filter((item) => item.roles.includes(role))
  const userName = session.user?.name ?? 'Пользователь'
  const userRole = session.user.role

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 bg-white border-r flex flex-col">
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
              <div className="text-xs text-gray-400 truncate">
                {roleLabels[userRole as string] || userRole || '—'}
              </div>
            </div>
          </div>
          <form
            action={async () => {
              'use server'
              await signOut({ redirectTo: '/login' })
            }}
          >
            <button className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 rounded-md flex items-center gap-2">
              <span>→</span> Выйти
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}

import { auth, signOut } from '@/auth'
import { redirect } from 'next/navigation'
import { getSessionPermissions } from '@/lib/permissions'
import DashboardSidebarClient from './DashboardSidebarClient'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')
  const { permissions } = await getSessionPermissions()

  const roleLabels: Record<string, string> = {
    ADMIN: 'Администратор',
    MANAGER: 'Менеджер',
    CHIEF_ENGINEER: 'Главный инженер',
    ENGINEER: 'Инженер',
    CLIENT: 'Клиент',
  }

  const role = session.user.role as string
  const hasPermission = (key: string) => permissions.has('*') || permissions.has(key)

  const navItems = [
    { href: '/', label: 'Dashboard', icon: '▦', roles: ['ADMIN', 'MANAGER', 'CHIEF_ENGINEER'], key: 'section:dashboard' },
    { href: '/clients', label: 'Клиенты', icon: '👥', roles: ['ADMIN', 'MANAGER'], key: 'section:clients' },
    {
      href: '/equipment',
      label: 'Оборудование',
      icon: '⚙️',
      roles: ['ADMIN', 'MANAGER', 'CHIEF_ENGINEER', 'ENGINEER'],
      key: 'section:equipment',
    },
    {
      href: '/tasks',
      label: 'Задачи',
      icon: '✓',
      roles: ['ADMIN', 'MANAGER', 'CHIEF_ENGINEER', 'ENGINEER'],
      key: 'section:tasks',
    },
    { href: '/engineers', label: 'Инженеры', icon: '🧑‍🔧', roles: ['ADMIN', 'MANAGER', 'CHIEF_ENGINEER'], key: 'section:dashboard' },
    { href: '/engineers/schedule', label: 'График', icon: '📅', roles: ['ADMIN', 'MANAGER', 'CHIEF_ENGINEER'], key: 'section:dashboard' },
    { href: '/history', label: 'История', icon: '🗂️', roles: ['ADMIN', 'MANAGER', 'CHIEF_ENGINEER'], key: 'section:reports' },
    { href: '/reports', label: 'Отчёты', icon: '📊', roles: ['ADMIN', 'MANAGER', 'CHIEF_ENGINEER'], key: 'section:reports' },
    { href: '/users', label: 'Пользователи', icon: '👤', roles: ['ADMIN'], key: 'section:users' },
    { href: '/access', label: 'Доступы', icon: '🔐', roles: ['ADMIN'], key: 'action:user.manage' },
    { href: '/map', label: 'Карта', icon: '🗺️', roles: ['ADMIN', 'MANAGER', 'CHIEF_ENGINEER'], key: 'section:map' },
    { href: '/references', label: 'Справочники', icon: '📋', roles: ['ADMIN', 'MANAGER'], key: 'section:references' },
  ].filter((item) => item.roles.includes(role) && hasPermission(item.key))
  const userName = session.user?.name ?? 'Пользователь'
  const userRole = session.user.role
  const roleLabel = roleLabels[userRole as string] || userRole || '—'
  const logoutAction = async () => {
    'use server'
    await signOut({ redirectTo: '/login' })
  }

  return (
    <DashboardSidebarClient
      navItems={navItems}
      userName={userName}
      roleLabel={roleLabel}
      logoutAction={logoutAction}
    >
      {children}
    </DashboardSidebarClient>
  )
}

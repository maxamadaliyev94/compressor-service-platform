import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getSessionPermissions } from '@/lib/permissions'
import DashboardSidebarClient from './DashboardSidebarClient'
import { UserSessionTracker } from '@/components/UserSessionTracker'
import { db } from '@/lib/db'

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

  type NavDef = { href: string; label: string; roles: string[]; key?: string }

  const navRaw: NavDef[] = [
    { href: '/my-company', label: 'Моя компания', roles: ['CLIENT'], key: 'section:client_portal' },
    {
      href: '/account',
      label: 'Настройка аккаунта',
      roles: ['ADMIN', 'MANAGER', 'CHIEF_ENGINEER', 'ENGINEER', 'CLIENT'],
    },
    { href: '/', label: 'Dashboard', roles: ['ADMIN', 'MANAGER', 'CHIEF_ENGINEER'], key: 'section:dashboard' },
    { href: '/clients', label: 'Клиенты', roles: ['ADMIN', 'MANAGER', 'CHIEF_ENGINEER'], key: 'section:clients' },
    {
      href: '/equipment',
      label: 'Оборудование',
      roles: ['ADMIN', 'MANAGER', 'CHIEF_ENGINEER', 'ENGINEER', 'CLIENT'],
      key: 'section:equipment',
    },
    {
      href: '/tasks',
      label: 'Задачи',
      roles: ['ADMIN', 'MANAGER', 'CHIEF_ENGINEER', 'ENGINEER', 'CLIENT'],
      key: 'section:tasks',
    },
    { href: '/chat', label: 'Чат', roles: ['ADMIN', 'MANAGER', 'CHIEF_ENGINEER', 'ENGINEER'] },
    { href: '/engineers', label: 'Инженеры', roles: ['ADMIN', 'MANAGER', 'CHIEF_ENGINEER'], key: 'section:dashboard' },
    { href: '/engineers/schedule', label: 'График', roles: ['ADMIN', 'MANAGER', 'CHIEF_ENGINEER'], key: 'section:dashboard' },
    { href: '/history', label: 'История', roles: ['ADMIN', 'MANAGER', 'CHIEF_ENGINEER'], key: 'section:reports' },
    { href: '/reports', label: 'Отчёты', roles: ['ADMIN', 'MANAGER', 'CHIEF_ENGINEER'], key: 'section:reports' },
    { href: '/users', label: 'Пользователи', roles: ['ADMIN'], key: 'section:users' },
    { href: '/access', label: 'Доступы', roles: ['ADMIN'], key: 'action:user.manage' },
    { href: '/map', label: 'Карта', roles: ['ADMIN', 'MANAGER', 'CHIEF_ENGINEER'], key: 'section:map' },
    { href: '/references', label: 'Справочники', roles: ['ADMIN', 'MANAGER'], key: 'section:references' },
  ]

  const navItems = navRaw
    .filter((item) => item.roles.includes(role) && (item.key === undefined || hasPermission(item.key)))
    .map(({ href, label }) => ({ href, label }))
  const userName = session.user?.name ?? 'Пользователь'
  const userRole = session.user.role
  const profile = await db.user.findUnique({
    where: { id: session.user.id },
    select: { avatarUrl: true },
  })
  const roleLabel = roleLabels[userRole as string] || userRole || '—'

  return (
    <DashboardSidebarClient
      navItems={navItems}
      userName={userName}
      roleLabel={roleLabel}
      userAvatarUrl={profile?.avatarUrl ?? null}
    >
      <UserSessionTracker />
      {children}
    </DashboardSidebarClient>
  )
}

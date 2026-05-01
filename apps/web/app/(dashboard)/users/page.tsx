import { db } from '@/lib/db'
import { auth } from '@/auth'
import { requirePermission, getSessionPermissions } from '@/lib/permissions'
import AddUserButton from './AddUserButton'
import UserActions from './UserActions'

const roleLabels: Record<string, string> = {
  ADMIN: 'Администратор',
  MANAGER: 'Менеджер',
  CHIEF_ENGINEER: 'Главный инженер',
  ENGINEER: 'Инженер',
  CLIENT: 'Клиент',
}
const roleColors: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-800',
  MANAGER: 'bg-blue-100 text-blue-800',
  CHIEF_ENGINEER: 'bg-indigo-100 text-indigo-800',
  ENGINEER: 'bg-green-100 text-green-800',
  CLIENT: 'bg-gray-100 text-gray-800',
}

export default async function UsersPage() {
  await requirePermission('section:users')
  const session = await auth()
  const { permissions } = await getSessionPermissions()
  const canManageUsers = permissions.has('*') || permissions.has('action:user.manage')
  const canViewUserPhone = permissions.has('*') || permissions.has('field:user.phone')
  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, login: true, role: true, email: true, phone: true, isActive: true, lastLoginAt: true, createdAt: true }
  })

  const activeCount = users.filter(u => u.isActive).length
  const engineerCount = users.filter(u => u.role === 'ENGINEER').length

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-center mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Пользователи</h1>
          <p className="text-sm text-gray-500 mt-1">{activeCount} активных · {engineerCount} инженеров</p>
        </div>
        {canManageUsers && <AddUserButton />}
      </div>

      <div className="md:hidden space-y-3">
        {users.map(user => (
          <div key={user.id} className={`bg-white border rounded-xl p-4 ${!user.isActive ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${user.isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                  {user.name.charAt(0)}
                </div>
                <div>
                  <div className="font-medium text-sm">{user.name}</div>
                  <div className="text-xs text-gray-500 break-all">@{user.login}</div>
                  <div className="text-xs text-gray-400 break-all">{user.email || '—'}</div>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColors[user.role]}`}>
                {roleLabels[user.role]}
              </span>
            </div>
            <div className="mt-3 space-y-1.5 text-xs">
              {canViewUserPhone && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-500">Телефон</span>
                  <span className="text-gray-700">{user.phone || '—'}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-500">Последний вход</span>
                <span className="text-gray-700 text-right">
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('ru-RU') : 'Не входил'}
                </span>
              </div>
            </div>
            <div className="mt-3">
              {canManageUsers ? (
                <UserActions user={user} currentUserId={session?.user?.id || ''} />
              ) : (
                <span className="text-xs text-gray-300">—</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block bg-white border rounded-xl overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3 font-medium">Пользователь</th>
              <th className="text-left p-3 font-medium">Роль</th>
              {canViewUserPhone && <th className="text-left p-3 font-medium">Телефон</th>}
              <th className="text-left p-3 font-medium">Последний вход</th>
              <th className="text-left p-3 font-medium">Активен</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className={`border-b last:border-0 hover:bg-gray-50 ${!user.isActive ? 'opacity-50' : ''}`}>
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${user.isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium">{user.name}</div>
                        <div className="text-xs text-gray-500">@{user.login}</div>
                        <div className="text-xs text-gray-400">{user.email || '—'}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColors[user.role]}`}>{roleLabels[user.role]}</span>
                </td>
                {canViewUserPhone && <td className="p-3 text-gray-600">{user.phone || '—'}</td>}
                <td className="p-3 text-gray-500 text-xs">
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleString('ru-RU')
                    : <span className="text-gray-300">Не входил</span>
                  }
                </td>
                <td className="p-3">
                  {canManageUsers ? (
                    <UserActions user={user} currentUserId={session?.user?.id || ''} />
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

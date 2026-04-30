import { db } from '@/lib/db'
import { auth } from '@/auth'
import { requireRole } from '@/lib/roles'
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
  await requireRole('ADMIN')
  const session = await auth()
  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, role: true, email: true, phone: true, isActive: true, lastLoginAt: true, createdAt: true }
  })

  const activeCount = users.filter(u => u.isActive).length
  const engineerCount = users.filter(u => u.role === 'ENGINEER').length

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Пользователи</h1>
          <p className="text-sm text-gray-500 mt-1">{activeCount} активных · {engineerCount} инженеров</p>
        </div>
        <AddUserButton />
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3 font-medium">Пользователь</th>
              <th className="text-left p-3 font-medium">Роль</th>
              <th className="text-left p-3 font-medium">Телефон</th>
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
                      <div className="text-xs text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColors[user.role]}`}>{roleLabels[user.role]}</span>
                </td>
                <td className="p-3 text-gray-600">{user.phone || '—'}</td>
                <td className="p-3 text-gray-500 text-xs">
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleString('ru-RU')
                    : <span className="text-gray-300">Не входил</span>
                  }
                </td>
                <td className="p-3">
                  <UserActions user={user} currentUserEmail={session?.user?.email || ''} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

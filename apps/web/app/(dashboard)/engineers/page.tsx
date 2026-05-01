import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import EngineersMonitorClient from './EngineersMonitorClient'

export default async function EngineersPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!['ADMIN', 'MANAGER', 'CHIEF_ENGINEER'].includes(session.user.role)) redirect('/403')

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Инженеры</h1>
        <p className="text-sm text-gray-500 mt-1">Мониторинг присутствия и загрузки инженеров</p>
      </div>
      <EngineersMonitorClient />
    </div>
  )
}

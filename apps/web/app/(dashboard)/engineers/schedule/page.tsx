import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import EngineersScheduleClient from './EngineersScheduleClient'

export default async function EngineersSchedulePage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!['ADMIN', 'MANAGER', 'CHIEF_ENGINEER'].includes(session.user.role)) redirect('/403')

  return (
    <div className="p-4 md:p-8">
      <EngineersScheduleClient />
    </div>
  )
}

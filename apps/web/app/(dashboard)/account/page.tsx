import { auth } from '@/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import AccountSettingsClient from './AccountSettingsClient'

export default async function AccountPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true },
  })
  if (!user) redirect('/login')

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold">Настройка аккаунта</h1>
        <p className="text-sm text-gray-500 mt-1">Профиль, пароль и биометрический вход</p>
      </div>
      <AccountSettingsClient userId={user.id} initialName={user.name} />
    </div>
  )
}

import { auth } from '@/auth'

export default async function ForbiddenPage() {
  const session = await auth()
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white border rounded-xl p-8 max-w-md text-center">
        <div className="text-6xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Нет доступа</h1>
        <p className="text-gray-500 mb-6">
          У вас нет прав для просмотра этой страницы.
          {session?.user?.role && (
            <span className="block mt-1 text-sm">Ваша роль: <strong>{session.user.role}</strong></span>
          )}
        </p>
        <a href="/" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700 inline-block">
          На главную
        </a>
      </div>
    </div>
  )
}

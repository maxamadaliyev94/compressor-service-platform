import { db } from '@/lib/db'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import KanbanBoard from './KanbanBoard'

export default async function KanbanPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const role = session.user.role

  const tasks = await db.serviceTask.findMany({
    where: {
      status: { not: 'CANCELLED' },
      ...(role === 'ENGINEER' ? { assignedToId: session.user.id } : {}),
    },
    include: {
      equipment: { include: { object: { include: { branch: { include: { client: true } } } } } },
      assignedTo: true,
    },
    orderBy: { createdAt: 'desc' },
  })
  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Канбан</h1>
          <p className="text-sm text-gray-500 mt-1">Управление задачами</p>
        </div>
        <div className="flex gap-3">
          <a href="/tasks" className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
            Список
          </a>
          <a
            href="/tasks/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
          >
            + Создать задачу
          </a>
        </div>
      </div>
      <KanbanBoard tasks={tasks} />
    </div>
  )
}

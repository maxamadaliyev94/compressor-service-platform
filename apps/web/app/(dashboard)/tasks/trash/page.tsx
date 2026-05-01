import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import TaskTrashTable from './TaskTrashTable'

export default async function TasksTrashPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (session.user.role !== 'ADMIN') redirect('/403')

  const tasks = await db.serviceTask.findMany({
    where: { deletedAt: { not: null } },
    include: {
      equipment: { select: { brand: true, model: true, serialNumber: true } },
      assignedTo: { select: { name: true } },
      deletedBy: { select: { name: true } },
    },
    orderBy: { deletedAt: 'desc' },
  })

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Корзина задач</h1>
          <p className="text-sm text-gray-500 mt-1">Удаленные задачи, доступно только администратору</p>
        </div>
        <a href="/tasks" className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
          ← К списку задач
        </a>
      </div>
      <TaskTrashTable tasks={tasks as any} />
    </div>
  )
}

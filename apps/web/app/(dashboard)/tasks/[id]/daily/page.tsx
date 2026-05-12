import { db } from '@/lib/db'
import { auth } from '@/auth'
import { notFound, redirect } from 'next/navigation'
import LongTermDailyForm from './LongTermDailyForm'

function buildInitialChecklist(
  regulation: {
    name: string | null
    items: { id: string; label: string }[]
  } | null,
): { label: string; checked: boolean }[] {
  if (regulation?.items?.length) {
    return regulation.items.map((i) => ({ label: i.label, checked: false }))
  }
  return [
    { label: 'Осмотр оборудования', checked: false },
    { label: 'Работы по заданию', checked: false },
    { label: 'Контроль параметров / безопасность', checked: false },
  ]
}

export default async function LongTermDailyPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) redirect('/login')

  const task = await db.serviceTask.findUnique({
    where: { id: params.id },
    include: {
      equipment: { include: { object: { include: { branch: { include: { client: true } } } } } },
      assignedTo: true,
      longTermEngineers: {
        where: { engineerId: session.user.id },
        select: { id: true },
      },
    },
  })
  if (!task || task.deletedAt) notFound()
  if (task.taskType !== 'LONG_TERM') redirect(`/tasks/${params.id}`)

  if (session.user.role === 'CLIENT') {
    redirect(`/tasks/${params.id}`)
  }
  const isLongTermMember =
    task.assignedToId === session.user.id || task.longTermEngineers.length > 0
  if (session.user.role === 'ENGINEER' && !isLongTermMember) {
    redirect(`/tasks/${params.id}`)
  }
  if (session.user.role !== 'ENGINEER') {
    redirect(`/tasks/${params.id}`)
  }

  if (['DONE', 'CANCELLED'].includes(task.status)) {
    redirect(`/tasks/${params.id}`)
  }

  const regulation = await db.maintenanceRegulation.findFirst({
    where: {
      taskType: task.type,
      equipmentType: task.equipment.type,
      isActive: true,
    },
    include: { items: { orderBy: { order: 'asc' } } },
  })

  const initialChecklist = buildInitialChecklist(regulation)
  const initialDate = new Date().toISOString().slice(0, 10)

  const entries = await db.dailyWork.findMany({
    where: { taskId: task.id },
    include: { engineer: { select: { name: true } } },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: 30,
  })

  return (
    <div className="p-4 md:p-8 max-w-3xl space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <a href={`/tasks/${task.id}`} className="text-gray-400 hover:text-gray-600">
          ← К задаче
        </a>
      </div>
      <h1 className="text-2xl font-bold">Дневной журнал · №{task.requestNumber}</h1>
      <p className="text-sm text-gray-600">
        {task.equipment.brand} {task.equipment.model} · {task.equipment.object.branch.client.name}
      </p>
      <LongTermDailyForm taskId={task.id} initialChecklist={initialChecklist} initialDate={initialDate} />
      <div className="bg-gray-50 border rounded-xl p-4">
        <h2 className="font-semibold text-gray-900 mb-2 text-sm">Недавние записи</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-gray-500">Пока нет сохранённых записей</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {entries.map((e) => (
              <li key={e.id} className="border-b border-gray-200 pb-2 last:border-0">
                <div className="font-medium text-gray-800">
                  {new Date(e.date).toLocaleDateString('ru-RU')} · {e.engineer.name}
                </div>
                <p className="text-gray-600 whitespace-pre-wrap mt-0.5">{e.description}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

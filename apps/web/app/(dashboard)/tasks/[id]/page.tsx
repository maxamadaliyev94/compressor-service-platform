import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import { auth } from '@/auth'

const typeLabels: Record<string, string> = {
  PLANNED_MAINTENANCE: 'Плановое ТО', DIAGNOSTICS: 'Диагностика',
  WARRANTY_REPAIR: 'Гарантийный ремонт', EMERGENCY: 'Аварийный выезд',
  INSTALLATION: 'Монтаж', COMMISSIONING: 'Пусконаладка',
}
const statusLabels: Record<string, string> = {
  NEW: 'Новая', ASSIGNED: 'Назначена', IN_PROGRESS: 'В работе',
  DONE: 'Выполнено', CANCELLED: 'Отменена', REVIEW: 'На проверке',
  DRAFT: 'Черновик', REVISION: 'Доработка',
}
const statusColors: Record<string, string> = {
  NEW: 'bg-gray-100 text-gray-700', ASSIGNED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700', DONE: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700', REVIEW: 'bg-purple-100 text-purple-700',
  DRAFT: 'bg-gray-100 text-gray-500', REVISION: 'bg-orange-100 text-orange-700',
}

export default async function TaskDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  const canExecute = ['ENGINEER', 'CHIEF_ENGINEER', 'ADMIN', 'MANAGER'].includes(
    session?.user?.role ?? ''
  )

  const task = await db.serviceTask.findUnique({
    where: { id: params.id },
    include: {
      equipment: {
        include: { object: { include: { branch: { include: { client: true } } } } }
      },
      assignedTo: true,
      createdBy: true,
      report: {
        include: { checklistItems: true, partsUsed: true, attachments: true }
      }
    }
  })
  if (!task) notFound()

  const isNotDone = !['DONE', 'CANCELLED'].includes(task.status)

  const eq = task.equipment
  const client = eq.object.branch.client

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <a href="/tasks" className="text-gray-400 hover:text-gray-600">← Задачи</a>
        <span className="text-gray-300">/</span>
        <span className="font-medium">{typeLabels[task.type]}</span>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">{typeLabels[task.type]}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {eq.brand} {eq.model} · {client.name}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[task.status]}`}>
            {statusLabels[task.status]}
          </span>
          {canExecute && isNotDone && (
            <a
              href={`/tasks/${task.id}/execute`}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 flex items-center gap-2"
            >
              ▶ Приступить к работе
            </a>
          )}
          {task.report && (
            <a href={`/api/tasks/${task.id}/pdf`} target="_blank"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 flex items-center gap-2">
              📄 Печать акта
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold mb-3">Оборудование</h2>
          <div className="space-y-2 text-sm">
            <div className="flex gap-2"><span className="text-gray-500 w-28">Бренд/Модель:</span>
              <a href={`/equipment/${eq.id}`} className="font-medium hover:text-blue-600">{eq.brand} {eq.model}</a>
            </div>
            <div className="flex gap-2"><span className="text-gray-500 w-28">Серийный №:</span><span>{eq.serialNumber}</span></div>
            <div className="flex gap-2"><span className="text-gray-500 w-28">Клиент:</span>
              <a href={`/clients/${client.id}`} className="hover:text-blue-600">{client.name}</a>
            </div>
            <div className="flex gap-2"><span className="text-gray-500 w-28">Объект:</span><span>{eq.object.name}</span></div>
            <div className="flex gap-2"><span className="text-gray-500 w-28">Моточасы:</span><span>{eq.currentHours} м/ч</span></div>
          </div>
        </div>

        <div className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold mb-3">Детали задачи</h2>
          <div className="space-y-2 text-sm">
            <div className="flex gap-2"><span className="text-gray-500 w-28">Тип:</span><span>{typeLabels[task.type]}</span></div>
            <div className="flex gap-2"><span className="text-gray-500 w-28">Приоритет:</span>
              <span className={`font-medium ${task.priority === 'EMERGENCY' ? 'text-red-600' : task.priority === 'HIGH' ? 'text-orange-600' : 'text-gray-700'}`}>
                {task.priority === 'LOW' ? 'Низкий' : task.priority === 'MEDIUM' ? 'Средний' : task.priority === 'HIGH' ? 'Высокий' : 'Аварийный'}
              </span>
            </div>
            <div className="flex gap-2"><span className="text-gray-500 w-28">Инженер:</span><span>{task.assignedTo?.name || 'Не назначен'}</span></div>
            <div className="flex gap-2"><span className="text-gray-500 w-28">Создал:</span><span>{task.createdBy.name}</span></div>
            <div className="flex gap-2"><span className="text-gray-500 w-28">Срок:</span>
              <span>{task.scheduledAt ? new Date(task.scheduledAt).toLocaleDateString('ru-RU') : '—'}</span>
            </div>
            {task.completedAt && (
              <div className="flex gap-2"><span className="text-gray-500 w-28">Выполнено:</span>
                <span>{new Date(task.completedAt).toLocaleDateString('ru-RU')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {task.comment && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-sm text-yellow-800 mb-1">Комментарий</h3>
          <p className="text-sm text-yellow-700">{task.comment}</p>
        </div>
      )}

      {task.report ? (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Отчёт о выполнении</h2>
              {task.report.actNumber && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  Акт № {task.report.actNumber}
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Моточасы</div>
                <div className="text-xl font-bold">{task.report.currentHours}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Следующее ТО</div>
                <div className="text-xl font-bold">{task.report.nextServiceHours || '—'}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Запчасти</div>
                <div className="text-xl font-bold">{task.report.partsUsed.length}</div>
              </div>
            </div>
            {task.report.notes && (
              <div className="mb-3">
                <div className="text-xs text-gray-500 mb-1">Комментарий инженера</div>
                <p className="text-sm text-gray-700">{task.report.notes}</p>
              </div>
            )}
            {task.report.recommendations && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Рекомендации клиенту</div>
                <p className="text-sm text-gray-700">{task.report.recommendations}</p>
              </div>
            )}
          </div>

          {task.report.checklistItems.length > 0 && (
            <div className="bg-white border rounded-xl p-5">
              <h2 className="font-semibold mb-3">Чек-лист ({task.report.checklistItems.filter(i => i.checked).length}/{task.report.checklistItems.length})</h2>
              <div className="space-y-1">
                {task.report.checklistItems.map(item => (
                  <div key={item.id} className="flex items-center gap-2 text-sm py-1">
                    <span className={item.checked ? 'text-green-500' : 'text-red-400'}>
                      {item.checked ? '✓' : '✗'}
                    </span>
                    <span className={item.checked ? 'text-gray-700' : 'text-gray-400 line-through'}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {task.report.partsUsed.length > 0 && (
            <div className="bg-white border rounded-xl p-5">
              <h2 className="font-semibold mb-3">Использованные запчасти</h2>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-2 font-medium">Наименование</th>
                    <th className="text-left p-2 font-medium">Артикул</th>
                    <th className="text-center p-2 font-medium">Кол-во</th>
                    <th className="text-left p-2 font-medium">Ед.</th>
                  </tr>
                </thead>
                <tbody>
                  {task.report.partsUsed.map(part => (
                    <tr key={part.id} className="border-b last:border-0">
                      <td className="p-2">{part.name}</td>
                      <td className="p-2 text-gray-500">{part.article || '—'}</td>
                      <td className="p-2 text-center font-medium">{part.quantity}</td>
                      <td className="p-2 text-gray-500">{part.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-3">
            <a href={`/api/tasks/${task.id}/pdf`} target="_blank"
              className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700 flex items-center gap-2">
              📄 Открыть PDF акт
            </a>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-400">
          <div className="text-3xl mb-2">📋</div>
          <p className="text-sm">Отчёт ещё не заполнен</p>
          <p className="text-xs mt-1">
            Инженер заполнит отчёт в браузере (кнопка «Приступить к работе») или в мобильном приложении
          </p>
        </div>
      )}
    </div>
  )
}

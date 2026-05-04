import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getWarrantyStatus } from '@csp/shared'
import PrintQR from './PrintQR'
import UpdateHours from './UpdateHours'
import EquipmentHistory from './EquipmentHistory'
import QuickTaskButton from './QuickTaskButton'
import EquipmentPhotoGallery from './EquipmentPhotoGallery'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { hasPermission, requirePermission } from '@/lib/permissions'
import type { Role } from '@prisma/client'
import { formatTaskScheduleRangeRu } from '@/lib/task-schedule-display'

export default async function EquipmentPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) redirect('/login')
  const role = session.user.role as Role
  const isClientPortal = role === 'CLIENT'
  if (!isClientPortal) {
    await requirePermission('section:equipment')
  } else if (!session.user.clientId) {
    redirect('/403')
  }
  const canViewWarranty =
    isClientPortal || (await hasPermission(role, 'field:equipment.warranty'))
  const eq = await db.equipment.findUnique({
    where: { id: params.id },
    include: {
      object: {
        include: {
          branch: {
            include: { client: true }
          }
        }
      },
      tasks: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: {
          assignedTo: true,
          report: {
            include: {
              partsUsed: true
            }
          }
        }
      },
      photos: { orderBy: { createdAt: 'desc' } },
    }
  })
  if (!eq) notFound()

  const client = eq.object.branch.client
  if (isClientPortal && session.user.clientId !== client.id) {
    notFound()
  }
  if (role === 'MANAGER' && client.managerId !== session.user.id) {
    notFound()
  }
  const ws = getWarrantyStatus(eq.warrantyUntil, eq.warrantyVoided)

  const wsColors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    EXPIRING: 'bg-orange-100 text-orange-800',
    EXPIRED: 'bg-gray-100 text-gray-600',
    VOIDED: 'bg-red-100 text-red-800',
  }
  const wsLabels: Record<string, string> = {
    ACTIVE: 'На гарантии', EXPIRING: 'Истекает',
    EXPIRED: 'Истекла', VOIDED: 'Аннулирована',
  }
  const typeLabels: Record<string, string> = {
    COMPRESSOR: 'Компрессор', DRYER: 'Осушитель',
    RECEIVER: 'Ресивер', FILTER: 'Фильтр',
    NITROGEN_GENERATOR: 'Азотный генератор', OTHER: 'Другое',
  }
  const statusLabels: Record<string, string> = {
    WORKING: 'Работает', STOPPED: 'Остановлен',
    REPAIR: 'В ремонте', PRESERVED: 'Консервация',
    DECOMMISSIONED: 'Списан',
  }
  const statusColors: Record<string, string> = {
    WORKING: 'bg-green-100 text-green-700',
    STOPPED: 'bg-gray-100 text-gray-700',
    REPAIR: 'bg-red-100 text-red-700',
    PRESERVED: 'bg-blue-100 text-blue-700',
    DECOMMISSIONED: 'bg-gray-100 text-gray-500',
  }
  const taskStatusLabels: Record<string, string> = {
    NEW: 'Новая', ASSIGNED: 'Назначена', IN_PROGRESS: 'В работе',
    DONE: 'Выполнено', CANCELLED: 'Отменена', REVIEW: 'На проверке',
    DRAFT: 'Черновик', REVISION: 'Доработка',
  }
  const taskStatusColors: Record<string, string> = {
    NEW: 'bg-gray-100 text-gray-700', ASSIGNED: 'bg-blue-100 text-blue-700',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-700', DONE: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-700', REVIEW: 'bg-purple-100 text-purple-700',
    DRAFT: 'bg-gray-100 text-gray-500', REVISION: 'bg-orange-100 text-orange-700',
  }

  const qrUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/equipment/${eq.id}`

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <div className="flex flex-wrap items-center gap-2 mb-6 text-sm text-gray-500">
        <a href={isClientPortal ? '/my-company' : '/equipment'} className="hover:text-gray-700">
          ← {isClientPortal ? 'Моя компания' : 'Оборудование'}
        </a>
        <span>/</span>
        {isClientPortal ? (
          <span className="hover:text-gray-700">{client.name}</span>
        ) : (
          <a href={`/clients/${client.id}`} className="hover:text-gray-700">
            {client.name}
          </a>
        )}
        <span>/</span>
        <span className="text-gray-900 font-medium">{eq.brand} {eq.model}</span>
      </div>

      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">{eq.brand} {eq.model}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {typeLabels[eq.type]} · {eq.serialNumber}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[eq.status]}`}>
            {statusLabels[eq.status]}
          </span>
          {canViewWarranty && (
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${wsColors[ws]}`}>
              {wsLabels[ws]}
            </span>
          )}
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-4 md:gap-6 ${isClientPortal ? '' : 'xl:grid-cols-3'}`}>
        <div className={isClientPortal ? 'space-y-4' : 'xl:col-span-2 space-y-4'}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border rounded-xl p-4 md:p-5">
              <h2 className="font-semibold mb-3 flex items-center gap-2">👥 Клиент</h2>
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-2"><span className="text-gray-500 w-24">Компания:</span>
                  {isClientPortal ? (
                    <span className="font-medium truncate">{client.name}</span>
                  ) : (
                    <a href={`/clients/${client.id}`} className="font-medium text-blue-600 hover:underline truncate">
                      {client.name}
                    </a>
                  )}
                </div>
                {client.city && <div className="flex flex-wrap gap-2"><span className="text-gray-500 w-24">Город:</span><span>{client.city}</span></div>}
                {client.contactPerson && <div className="flex flex-wrap gap-2"><span className="text-gray-500 w-24">Контакт:</span><span>{client.contactPerson}</span></div>}
                {client.phone && <div className="flex flex-wrap gap-2"><span className="text-gray-500 w-24">Телефон:</span>
                  <a href={`tel:${client.phone}`} className="text-blue-600 hover:underline">{client.phone}</a>
                </div>}
                {client.email && <div className="flex flex-wrap gap-2"><span className="text-gray-500 w-24">Email:</span>
                  <a href={`mailto:${client.email}`} className="text-blue-600 hover:underline truncate">{client.email}</a>
                </div>}
                <div className="flex flex-wrap gap-2"><span className="text-gray-500 w-24">Объект:</span><span>{eq.object.name}</span></div>
                {eq.object.branch.address && <div className="flex flex-wrap gap-2"><span className="text-gray-500 w-24">Адрес:</span><span className="text-xs break-words">{eq.object.branch.address}</span></div>}
              </div>
            </div>

            <div className="bg-white border rounded-xl p-4 flex flex-col items-center gap-2 min-w-0">
              <h2 className="font-semibold self-start text-sm">QR-код</h2>
              <div className="bg-gray-50 border rounded-lg p-2">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrUrl)}`}
                  alt="QR" width={120} height={120}/>
              </div>
              <p className="text-xs text-gray-400 text-center">Наклейте на оборудование</p>
              <div className="flex flex-col sm:flex-row gap-2 w-full">
                <a href={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}`}
                  download className="flex-1 text-center text-xs text-blue-600 hover:underline border border-blue-200 py-1 rounded-lg hover:bg-blue-50">
                  📥 Скачать
                </a>
                <PrintQR serialNumber={eq.serialNumber} brand={eq.brand} model={eq.model} qrUrl={qrUrl} />
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-xl p-5">
            <h2 className="font-semibold mb-3 flex items-center gap-2">⚙️ Технические данные</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div className="flex flex-wrap gap-2"><span className="text-gray-500 w-28">Тип:</span><span>{typeLabels[eq.type]}</span></div>
              <div className="flex flex-wrap gap-2"><span className="text-gray-500 w-28">Бренд:</span><span className="font-medium">{eq.brand}</span></div>
              <div className="flex flex-wrap gap-2"><span className="text-gray-500 w-28">Модель:</span><span className="font-medium">{eq.model}</span></div>
              <div className="flex flex-wrap gap-2"><span className="text-gray-500 w-28">Серийный №:</span>
                <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{eq.serialNumber}</span>
              </div>
              <div className="flex flex-wrap gap-2"><span className="text-gray-500 w-28">Год выпуска:</span><span>{eq.yearOfManufacture || '—'}</span></div>
              <div className="flex flex-wrap gap-2"><span className="text-gray-500 w-28">Установлен:</span>
                <span>{eq.installDate ? new Date(eq.installDate).toLocaleDateString('ru-RU') : '—'}</span>
              </div>
              {canViewWarranty && (
                <div className="flex flex-wrap gap-2"><span className="text-gray-500 w-28">Гарантия до:</span>
                  <span className={ws === 'EXPIRED' ? 'text-red-600' : ws === 'EXPIRING' ? 'text-orange-600' : 'text-green-600'}>
                    {eq.warrantyUntil ? new Date(eq.warrantyUntil).toLocaleDateString('ru-RU') : '—'}
                  </span>
                </div>
              )}
              <div className="flex flex-wrap gap-2"><span className="text-gray-500 w-28">Статус:</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[eq.status]}`}>
                  {statusLabels[eq.status]}
                </span>
              </div>
            </div>
          </div>

          {!isClientPortal && (
            <UpdateHours equipmentId={eq.id} currentHours={eq.currentHours} nextServiceHours={eq.nextServiceHours} />
          )}

          <div className="bg-white border rounded-xl p-5">
            <h2 className="font-semibold mb-3 flex items-center gap-2">🖼️ Фото оборудования</h2>
            {eq.photos.length === 0 ? (
              <p className="text-sm text-gray-400">Фото пока не добавлены</p>
            ) : (
              <EquipmentPhotoGallery photos={eq.photos.map((photo) => ({ id: photo.id, url: photo.url }))} />
            )}
          </div>

          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="font-semibold">История обслуживания ({eq.tasks.length})</h2>
              {!isClientPortal && (
                <QuickTaskButton equipmentId={eq.id} createdById={session.user.id} role={role} />
              )}
            </div>
            {eq.tasks.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                <div className="text-3xl mb-2">📋</div>
                История работ пока пуста
              </div>
            ) : (
              <div className="divide-y">
                {eq.tasks.map(task => {
                  const typeRu: Record<string, string> = {
                    PLANNED_MAINTENANCE: 'Плановое ТО',
                    DIAGNOSTICS: 'Диагностика',
                    WARRANTY_REPAIR: 'Гарантийный ремонт',
                    EMERGENCY: 'Аварийный выезд',
                    INSTALLATION: 'Монтаж',
                    COMMISSIONING: 'Пусконаладка',
                  }
                  const priorityColors: Record<string, string> = {
                    LOW: 'bg-gray-100 text-gray-600',
                    MEDIUM: 'bg-blue-100 text-blue-600',
                    HIGH: 'bg-orange-100 text-orange-600',
                    EMERGENCY: 'bg-red-100 text-red-600',
                  }
                  const priorityLabels: Record<string, string> = {
                    LOW: 'Низкий', MEDIUM: 'Средний', HIGH: 'Высокий', EMERGENCY: 'Аварийный',
                  }
                  const isDone = task.status === 'DONE'

                  return (
                    <div key={task.id} className="relative p-4 hover:bg-gray-50 transition-colors group">
                      <Link
                        href={`/tasks/${task.id}`}
                        className="absolute inset-0 z-0 rounded-lg"
                        aria-label="Открыть задачу"
                      />
                      <div className="relative z-[1] flex items-start justify-between gap-4 pointer-events-none">
                        <div className="flex gap-3 flex-1 min-w-0">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                            isDone ? 'bg-green-100 text-green-700' :
                            task.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                            task.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {isDone ? '✓' : task.status === 'CANCELLED' ? '✕' : task.status === 'IN_PROGRESS' ? '▶' : '○'}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-semibold text-sm text-gray-900">
                                {typeRu[task.type] || task.type}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[task.priority]}`}>
                                {priorityLabels[task.priority]}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${taskStatusColors[task.status]}`}>
                                {taskStatusLabels[task.status]}
                              </span>
                            </div>

                            {task.assignedTo && (
                              <div className="flex items-center gap-1.5 mb-1">
                                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                                  {task.assignedTo.name.charAt(0)}
                                </div>
                                <span className="text-xs text-gray-600">{task.assignedTo.name}</span>
                              </div>
                            )}

                            {task.report && (
                              <div className="mt-2 bg-green-50 border border-green-100 rounded-lg p-2.5 grid grid-cols-2 gap-x-4 gap-y-1">
                                <div className="text-xs text-gray-500">
                                  Моточасы: <span className="font-semibold text-gray-800">{task.report.currentHours} м/ч</span>
                                </div>
                                {task.report.nextServiceHours && (
                                  <div className="text-xs text-gray-500">
                                    След. ТО: <span className="font-semibold text-gray-800">{task.report.nextServiceHours} м/ч</span>
                                  </div>
                                )}
                                {task.report.partsUsed?.length > 0 && (
                                  <div className="text-xs text-gray-500 col-span-2">
                                    Запчасти: <span className="font-medium text-gray-700">
                                      {task.report.partsUsed.map((p: any) => `${p.name} (${p.quantity} ${p.unit})`).join(', ')}
                                    </span>
                                  </div>
                                )}
                                {task.report.notes && (
                                  <div className="text-xs text-gray-500 col-span-2 italic">
                                    "{task.report.notes}"
                                  </div>
                                )}
                                {task.report.recommendations && (
                                  <div className="text-xs col-span-2 bg-yellow-50 border border-yellow-100 rounded px-2 py-1 text-yellow-800">
                                    💡 {task.report.recommendations}
                                  </div>
                                )}
                                {task.report.actNumber && (
                                  <div className="text-xs text-gray-400 col-span-2">
                                    Акт № {task.report.actNumber}
                                  </div>
                                )}
                              </div>
                            )}

                            {task.comment && !task.report && (
                              <div className="text-xs text-gray-500 italic mt-1">"{task.comment}"</div>
                            )}
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0 space-y-1">
                          <div className="text-xs text-gray-400">
                            {task.completedAt
                              ? new Date(task.completedAt).toLocaleDateString('ru-RU')
                              : formatTaskScheduleRangeRu(task) !== '—'
                                ? formatTaskScheduleRangeRu(task)
                                : '—'}
                          </div>
                          {task.report && (
                            <a
                              href={`/api/tasks/${task.id}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="pointer-events-auto relative z-[2] inline-block text-xs text-blue-600 hover:underline border border-blue-200 px-2 py-0.5 rounded hover:bg-blue-50"
                            >
                              📄 Акт
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {!isClientPortal && (
          <div className="xl:col-span-1">
            <EquipmentHistory equipmentId={eq.id} />
          </div>
        )}
      </div>
    </div>
  )
}

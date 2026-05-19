import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import { getWarrantyStatus } from '@csp/shared'
import PrintQR from './PrintQR'
import UpdateHours from './UpdateHours'
import EquipmentHistory from './EquipmentHistory'
import QuickTaskButton from './QuickTaskButton'
import EquipmentPhotosEditor from './EquipmentPhotosEditor'
import EquipmentTechnicalData from './EquipmentTechnicalData'
import TransferEquipmentBranch from './TransferEquipmentBranch'
import EquipmentMaintenanceHistory from './EquipmentMaintenanceHistory'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { hasPermission, requirePermission } from '@/lib/permissions'
import type { Role } from '@prisma/client'
import { sanitizeTasksForClientPortal } from '@/lib/client-portal-tasks'

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
  const ws = getWarrantyStatus(eq.warrantyUntil, eq.warrantyVoided)

  const tasksForHistory = isClientPortal
    ? await sanitizeTasksForClientPortal(eq.tasks)
    : eq.tasks

  const maintenanceTasks = tasksForHistory.map((task) => ({
    id: task.id,
    type: task.type,
    priority: task.priority,
    status: task.status,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    scheduledAt: task.scheduledAt ? task.scheduledAt.toISOString() : null,
    startDate: task.startDate ? task.startDate.toISOString() : null,
    endDate: task.endDate ? task.endDate.toISOString() : null,
    taskType: task.taskType,
    comment: task.comment,
    assignedTo: task.assignedTo ? { name: task.assignedTo.name } : null,
    report: task.report
      ? {
          currentHours: task.report.currentHours,
          nextServiceHours: task.report.nextServiceHours,
          partsUsed: task.report.partsUsed.map((p) => ({
            name: p.name,
            quantity: p.quantity,
            unit: p.unit,
          })),
          notes: task.report.notes,
          recommendations: task.report.recommendations,
          actNumber: task.report.actNumber,
        }
      : null,
  }))

  const canBulkDeleteTasks = !isClientPortal && role === 'ADMIN'

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
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-gray-500 w-24">Филиал:</span>
                  <span>{eq.object.branch.name}</span>
                  {!isClientPortal && (role === 'ADMIN' || role === 'MANAGER') && (
                    <TransferEquipmentBranch
                      equipmentId={eq.id}
                      currentClientId={client.id}
                      currentBranchId={eq.object.branch.id}
                      currentBranchName={eq.object.branch.name}
                    />
                  )}
                </div>
                {eq.object.name.trim() !== eq.object.branch.name.trim() && (
                  <div className="flex flex-wrap gap-2"><span className="text-gray-500 w-24">Площадка:</span><span>{eq.object.name}</span></div>
                )}
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

          <EquipmentTechnicalData
            equipmentId={eq.id}
            canEdit={!isClientPortal && (role === 'ADMIN' || role === 'MANAGER')}
            canViewWarranty={canViewWarranty}
            initial={{
              type: eq.type,
              brand: eq.brand,
              model: eq.model,
              serialNumber: eq.serialNumber,
              yearOfManufacture: eq.yearOfManufacture,
              installDate: eq.installDate ? eq.installDate.toISOString() : null,
              warrantyUntil: eq.warrantyUntil ? eq.warrantyUntil.toISOString() : null,
              warrantyVoided: eq.warrantyVoided,
              status: eq.status,
              pressureBar: eq.pressureBar,
              currentHours: eq.currentHours,
              nextServiceHours: eq.nextServiceHours,
              notes: eq.notes,
            }}
          />

          {!isClientPortal && (
            <UpdateHours
              equipmentId={eq.id}
              currentHours={eq.currentHours}
              nextServiceHours={eq.nextServiceHours}
              initialHoursPerDay={eq.hoursPerDay}
              initialDaysPerWeek={eq.daysPerWeek}
            />
          )}

          <EquipmentPhotosEditor
            equipmentId={eq.id}
            photos={eq.photos.map((photo) => ({ id: photo.id, url: photo.url }))}
            canEdit={!isClientPortal && (role === 'ADMIN' || role === 'MANAGER')}
          />

          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="font-semibold">История обслуживания ({tasksForHistory.length})</h2>
              {!isClientPortal && (
                <QuickTaskButton equipmentId={eq.id} createdById={session.user.id} role={role} />
              )}
            </div>
            <EquipmentMaintenanceHistory tasks={maintenanceTasks} canBulkDelete={canBulkDeleteTasks} />
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

import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import { getMaintenanceStatus, getWarrantyStatus } from '@csp/shared'
import AddBranchButton from './AddBranchButton'
import EditBranchButton from './EditBranchButton'
import ClientActions from './ClientActions'
import { auth } from '@/auth'
import ClientManagerCard from './ClientManagerCard'
import ClientAttachedNotifyUserCard from './ClientAttachedNotifyUserCard'

type Branch = {
  id: string
  name: string
  address?: string | null
  contactPerson?: string | null
  phone?: string | null
  workingHours?: string | null
  latitude?: number | null
  longitude?: number | null
  objects: {
    id: string
    name: string
    equipment: {
      id: string
      brand: string
      model: string
      serialNumber?: string | null
      currentHours: number
      nextServiceHours?: number | null
      warrantyUntil?: Date | null
      warrantyVoided: boolean
      tasks: { id: string }[]
    }[]
  }[]
}

export default async function ClientPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) notFound()
  const role = session.user.role
  const isAdmin = session?.user?.role === 'ADMIN'

  const client = await db.client.findUnique({
    where: { id: params.id },
    include: {
      manager: { select: { id: true, name: true, email: true, phone: true } },
      attachedNotifyUser: { select: { id: true, name: true, login: true, email: true } },
      branches: {
        include: {
          objects: {
            include: {
              equipment: {
                include: { tasks: { orderBy: { createdAt: 'desc' }, take: 3 } },
              },
            },
          },
        },
      },
    },
  })
  if (!client) notFound()
  if (role === 'MANAGER' && client.managerId !== session.user.id) notFound()

  const canManageNotify = isAdmin || (role === 'MANAGER' && client.managerId === session.user.id)

  const allEquipment = client.branches.flatMap((b: Branch) => b.objects.flatMap((o) => o.equipment))
  const allTasks = allEquipment.flatMap((e) => e.tasks)

  const statusColors: Record<string, string> = {
    VIP: 'bg-purple-100 text-purple-800',
    STANDART: 'bg-blue-100 text-blue-800',
    PASSIVE: 'bg-gray-100 text-gray-500',
  }
  const statusLabels: Record<string, string> = {
    VIP: '⭐ VIP',
    STANDART: 'Стандарт',
    PASSIVE: 'Пассивный',
  }
  const msColors: Record<string, string> = {
    NORMAL: 'bg-green-100 text-green-800',
    WARNING: 'bg-yellow-100 text-yellow-800',
    URGENT: 'bg-orange-100 text-orange-800',
    OVERDUE: 'bg-red-100 text-red-800',
  }
  const msLabels: Record<string, string> = {
    NORMAL: 'Норма',
    WARNING: 'Скоро ТО',
    URGENT: 'Срочно',
    OVERDUE: 'Просрочено',
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-6">
        <a href="/clients" className="text-gray-400 hover:text-gray-600">
          ← Клиенты
        </a>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold">{client.name}</h1>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[client.status]}`}>{statusLabels[client.status]}</span>
        <div className="flex items-center gap-3">
          <ClientActions client={client} isAdmin={isAdmin} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Оборудования</p>
          <p className="text-2xl font-bold">{allEquipment.length}</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Филиалов</p>
          <p className="text-2xl font-bold">{client.branches.length}</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Задач</p>
          <p className="text-2xl font-bold">{allTasks.length}</p>
        </div>
      </div>

      <ClientManagerCard
        clientId={client.id}
        manager={client.manager}
        canManage={isAdmin}
      />

      <ClientAttachedNotifyUserCard
        clientId={client.id}
        attachedUser={client.attachedNotifyUser}
        canManage={canManageNotify}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6 mb-6">
        <div className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold mb-3">Контакты</h2>
          <div className="space-y-2 text-sm">
            {client.contactPerson && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-24">Контакт:</span>
                <span>{client.contactPerson}</span>
              </div>
            )}
            {client.phone && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-24">Телефон:</span>
                <span>{client.phone}</span>
              </div>
            )}
            {client.email && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-24">Email:</span>
                <span>{client.email}</span>
              </div>
            )}
            {client.city && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-24">Город:</span>
                <span>🇺🇿 {client.city}, {client.country || 'Узбекистан'}</span>
              </div>
            )}
            {client.inn && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-24">ИНН:</span>
                <span>{client.inn}</span>
              </div>
            )}
            {client.comment && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-24">Комментарий:</span>
                <span>{client.comment}</span>
              </div>
            )}
          </div>
        </div>
        <div className="bg-white border rounded-xl p-5">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">Филиалы и объекты</h2>
            <AddBranchButton clientId={client.id} />
          </div>
          <div className="space-y-3">
            {client.branches.map((branch: Branch) => (
              <div key={branch.id} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div className="font-medium text-sm min-w-0 flex-1">{branch.name}</div>
                  <div className="flex items-center gap-2 shrink-0">
                    {branch.workingHours && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                        🕐 {branch.workingHours}
                      </span>
                    )}
                    <EditBranchButton
                      branch={{
                        id: branch.id,
                        name: branch.name,
                        address: branch.address ?? null,
                        contactPerson: branch.contactPerson ?? null,
                        phone: branch.phone ?? null,
                        workingHours: branch.workingHours ?? null,
                        latitude: branch.latitude ?? null,
                        longitude: branch.longitude ?? null,
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  {branch.address && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span>📍</span>
                      <span>{branch.address}</span>
                    </div>
                  )}
                  {branch.contactPerson && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span>👤</span>
                      <span>{branch.contactPerson}</span>
                    </div>
                  )}
                  {branch.phone && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span>📞</span>
                      <a href={`tel:${branch.phone}`} className="text-blue-600 hover:underline">
                        {branch.phone}
                      </a>
                    </div>
                  )}
                </div>
                {branch.objects.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {branch.objects.map((obj) => (
                      <span key={obj.id} className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                        {obj.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="md:hidden space-y-3 mb-4">
        {allEquipment.map((eq) => {
          const ms = eq.nextServiceHours ? getMaintenanceStatus(eq.currentHours, eq.nextServiceHours) : 'NORMAL'
          const ws = getWarrantyStatus(eq.warrantyUntil, eq.warrantyVoided)
          const wsColors: Record<string, string> = {
            ACTIVE: 'bg-green-100 text-green-800',
            EXPIRING: 'bg-orange-100 text-orange-800',
            EXPIRED: 'bg-gray-100 text-gray-600',
            VOIDED: 'bg-red-100 text-red-800',
          }
          const wsLabels: Record<string, string> = {
            ACTIVE: 'На гарантии',
            EXPIRING: 'Истекает',
            EXPIRED: 'Истекла',
            VOIDED: 'Аннулирована',
          }
          return (
            <a key={eq.id} href={`/equipment/${eq.id}`} className="block bg-white border rounded-xl p-3">
              <div className="font-medium text-sm">{eq.brand} {eq.model}</div>
              <div className="text-xs text-gray-500">{eq.serialNumber}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${msColors[ms]}`}>{msLabels[ms]}</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${wsColors[ws]}`}>{wsLabels[ws]}</span>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                {eq.currentHours} м/ч{eq.nextServiceHours ? ` · след: ${eq.nextServiceHours} м/ч` : ''}
              </div>
            </a>
          )
        })}
      </div>

      <div className="hidden md:block bg-white border rounded-xl overflow-hidden">
        <div className="flex flex-col gap-2 md:flex-row md:justify-between md:items-center p-4 border-b">
          <h2 className="font-semibold">Оборудование</h2>
          <a href={`/equipment/new`} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-blue-700">
            + Добавить
          </a>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3 font-medium">Оборудование</th>
              <th className="text-left p-3 font-medium">Моточасы</th>
              <th className="text-left p-3 font-medium">Статус ТО</th>
              <th className="text-left p-3 font-medium">Гарантия</th>
            </tr>
          </thead>
          <tbody>
            {allEquipment.map((eq) => {
              const ms = eq.nextServiceHours ? getMaintenanceStatus(eq.currentHours, eq.nextServiceHours) : 'NORMAL'
              const ws = getWarrantyStatus(eq.warrantyUntil, eq.warrantyVoided)
              const wsColors: Record<string, string> = {
                ACTIVE: 'bg-green-100 text-green-800',
                EXPIRING: 'bg-orange-100 text-orange-800',
                EXPIRED: 'bg-gray-100 text-gray-600',
                VOIDED: 'bg-red-100 text-red-800',
              }
              const wsLabels: Record<string, string> = {
                ACTIVE: 'На гарантии',
                EXPIRING: 'Истекает',
                EXPIRED: 'Истекла',
                VOIDED: 'Аннулирована',
              }
              return (
                <tr key={eq.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="p-3">
                    <a href={`/equipment/${eq.id}`} className="font-medium hover:text-blue-600">
                      {eq.brand} {eq.model}
                    </a>
                    <div className="text-xs text-gray-500">{eq.serialNumber}</div>
                  </td>
                  <td className="p-3">
                    <div>{eq.currentHours} м/ч</div>
                    {eq.nextServiceHours && <div className="text-xs text-gray-500">след: {eq.nextServiceHours} м/ч</div>}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${msColors[ms]}`}>{msLabels[ms]}</span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${wsColors[ws]}`}>{wsLabels[ws]}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
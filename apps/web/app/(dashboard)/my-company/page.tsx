import { db } from '@/lib/db'
import { auth } from '@/auth'
import { requirePermission } from '@/lib/permissions'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getMaintenanceStatus, getWarrantyStatus } from '@csp/shared'

type EquipmentRow = {
  id: string
  brand: string
  model: string
  serialNumber: string
  currentHours: number
  nextServiceHours: number | null
  warrantyUntil: Date | null
  warrantyVoided: boolean
}

export default async function MyCompanyPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (session.user.role !== 'CLIENT') redirect('/')
  await requirePermission('section:client_portal')

  const clientId = session.user.clientId
  if (!clientId) {
    return (
      <main className="p-4 md:p-8 max-w-2xl">
        <h1 className="text-xl md:text-2xl font-bold mb-2">Моя компания</h1>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Ваша учётная запись ещё не привязана к организации в системе. Обратитесь к администратору сервиса — после
          привязки здесь появятся филиалы и оборудование вашей компании.
        </div>
      </main>
    )
  }

  const client = await db.client.findUnique({
    where: { id: clientId },
    include: {
      branches: {
        orderBy: { name: 'asc' },
        include: {
          objects: {
            orderBy: { name: 'asc' },
            include: {
              equipment: {
                orderBy: [{ brand: 'asc' }, { model: 'asc' }],
              },
            },
          },
        },
      },
    },
  })
  if (!client) notFound()

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

  const allEquipment = client.branches.flatMap((b) => b.objects.flatMap((o) => o.equipment))

  return (
    <main className="p-4 md:p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold">{client.name}</h1>
        <p className="text-gray-500 text-sm mt-1">
          Филиалы и оборудование · {client.branches.length}{' '}
          {client.branches.length === 1 ? 'филиал' : client.branches.length < 5 ? 'филиала' : 'филиалов'}
          {allEquipment.length > 0 ? ` · ${allEquipment.length} ед. оборудования` : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Оборудование</p>
          <p className="text-2xl font-bold">{allEquipment.length}</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Филиалы</p>
          <p className="text-2xl font-bold">{client.branches.length}</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Объекты</p>
          <p className="text-2xl font-bold">{client.branches.reduce((n, b) => n + b.objects.length, 0)}</p>
        </div>
      </div>

      {(client.contactPerson || client.phone || client.city) && (
        <div className="bg-white border rounded-xl p-5 mb-6">
          <h2 className="font-semibold mb-3">Контакты компании</h2>
          <div className="space-y-2 text-sm">
            {client.contactPerson && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-28">Контакт:</span>
                <span>{client.contactPerson}</span>
              </div>
            )}
            {client.phone && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-28">Телефон:</span>
                <a href={`tel:${client.phone}`} className="text-blue-600 hover:underline">
                  {client.phone}
                </a>
              </div>
            )}
            {client.city && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-28">Город:</span>
                <span>
                  {client.city}, {client.country || 'Узбекистан'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <h2 className="font-semibold text-lg mb-3">Филиалы и оборудование</h2>
      <div className="space-y-6">
        {client.branches.map((branch) => (
          <div key={branch.id} className="bg-white border rounded-xl overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h3 className="font-semibold">{branch.name}</h3>
              {branch.address && <p className="text-xs text-gray-600 mt-1">📍 {branch.address}</p>}
              {(branch.contactPerson || branch.phone) && (
                <p className="text-xs text-gray-600 mt-1">
                  {branch.contactPerson && <span>👤 {branch.contactPerson}</span>}
                  {branch.contactPerson && branch.phone && ' · '}
                  {branch.phone && (
                    <a href={`tel:${branch.phone}`} className="text-blue-600 hover:underline">
                      {branch.phone}
                    </a>
                  )}
                </p>
              )}
            </div>

            {branch.objects.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">Объектов в этом филиале пока нет.</div>
            ) : (
              <div className="divide-y">
                {branch.objects.map((obj) => (
                  <div key={obj.id} className="p-4">
                    <div className="font-medium text-sm mb-2">{obj.name}</div>
                    {obj.equipment.length === 0 ? (
                      <p className="text-xs text-gray-500">Оборудование не добавлено.</p>
                    ) : (
                      <div className="md:hidden space-y-2">
                        {obj.equipment.map((eq: EquipmentRow) => {
                          const ms = eq.nextServiceHours
                            ? getMaintenanceStatus(eq.currentHours, eq.nextServiceHours)
                            : 'NORMAL'
                          const ws = getWarrantyStatus(eq.warrantyUntil, eq.warrantyVoided)
                          return (
                            <Link
                              key={eq.id}
                              href={`/equipment/${eq.id}`}
                              className="block border rounded-lg p-3 hover:bg-gray-50"
                            >
                              <div className="font-medium text-sm">
                                {eq.brand} {eq.model}
                              </div>
                              <div className="text-xs text-gray-500 font-mono">{eq.serialNumber}</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${msColors[ms]}`}>
                                  {msLabels[ms]}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${wsColors[ws]}`}>
                                  {wsLabels[ws]}
                                </span>
                              </div>
                              <div className="mt-2 text-xs text-gray-600">
                                {eq.currentHours} м/ч
                                {eq.nextServiceHours != null && ` · след. ТО: ${eq.nextServiceHours} м/ч`}
                              </div>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                    {obj.equipment.length > 0 && (
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full min-w-[560px] text-sm">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="text-left p-2 font-medium">Оборудование</th>
                              <th className="text-left p-2 font-medium">Моточасы</th>
                              <th className="text-left p-2 font-medium">Статус ТО</th>
                              <th className="text-left p-2 font-medium">Гарантия</th>
                            </tr>
                          </thead>
                          <tbody>
                            {obj.equipment.map((eq: EquipmentRow) => {
                              const ms = eq.nextServiceHours
                                ? getMaintenanceStatus(eq.currentHours, eq.nextServiceHours)
                                : 'NORMAL'
                              const ws = getWarrantyStatus(eq.warrantyUntil, eq.warrantyVoided)
                              return (
                                <tr key={eq.id} className="border-b last:border-0 hover:bg-gray-50">
                                  <td className="p-2">
                                    <Link href={`/equipment/${eq.id}`} className="font-medium text-blue-600 hover:underline">
                                      {eq.brand} {eq.model}
                                    </Link>
                                    <div className="text-xs text-gray-500 font-mono">{eq.serialNumber}</div>
                                  </td>
                                  <td className="p-2">
                                    <div>{eq.currentHours} м/ч</div>
                                    {eq.nextServiceHours != null && (
                                      <div className="text-xs text-gray-500">след. ТО: {eq.nextServiceHours} м/ч</div>
                                    )}
                                  </td>
                                  <td className="p-2">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${msColors[ms]}`}>
                                      {msLabels[ms]}
                                    </span>
                                  </td>
                                  <td className="p-2">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${wsColors[ws]}`}>
                                      {wsLabels[ws]}
                                    </span>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  )
}

import { db } from '@/lib/db'
import { auth } from '@/auth'
import ExportClientsButton from './ExportClientsButton'
import ClientsTable from './ClientsTable'

export default async function ClientsPage() {
  const session = await auth()
  if (!session) return null
  const role = session.user.role
  const isAdmin = role === 'ADMIN'
  const isEngineer = role === 'ENGINEER'
  const canEditClient = ['ADMIN', 'MANAGER'].includes(role)

  const clients = await db.client.findMany({
    include: {
      manager: { select: { id: true, name: true, email: true, phone: true } },
      branches: { include: { objects: { include: { equipment: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const managerFilterUI =
    role === 'ADMIN' ? 'admin-dropdown' : role === 'MANAGER' ? 'manager-buttons' : null

  const managerOptions =
    role === 'ADMIN'
      ? await db.user.findMany({
          where: { role: 'MANAGER' },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : undefined

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-center mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Клиенты</h1>
          <p className="text-sm text-gray-500 mt-1">
            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium mr-1">UZ</span>
            Узбекистан
          </p>
        </div>
        <div className="flex flex-col w-full md:w-auto md:flex-row gap-2 md:gap-3">
          <ExportClientsButton clients={clients} />
          {(role === 'ADMIN' || role === 'MANAGER') && (
            <a href="/clients/new" className="w-full md:w-auto min-h-11 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 inline-flex items-center justify-center">
              + Добавить клиента
            </a>
          )}
        </div>
      </div>
      <ClientsTable
        clients={clients}
        isAdmin={isAdmin}
        canEditClient={canEditClient}
        currentUserId={session.user.id}
        managerFilterUI={managerFilterUI}
        managerOptions={managerOptions}
      />
    </div>
  )
}

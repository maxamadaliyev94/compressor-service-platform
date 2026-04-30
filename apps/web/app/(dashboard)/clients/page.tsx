import { db } from '@/lib/db'
import { auth } from '@/auth'
import ExportClientsButton from './ExportClientsButton'
import ClientsTable from './ClientsTable'

export default async function ClientsPage() {
  const session = await auth()
  const isAdmin = session?.user?.role === 'ADMIN'

  const clients = await db.client.findMany({
    include: { branches: { include: { objects: { include: { equipment: true } } } } },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Клиенты</h1>
          <p className="text-sm text-gray-500 mt-1">
            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium mr-1">UZ</span>
            Узбекистан
          </p>
        </div>
        <div className="flex gap-3">
          <ExportClientsButton clients={clients} />
          <a href="/clients/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
            + Добавить клиента
          </a>
        </div>
      </div>
      <ClientsTable clients={clients} isAdmin={isAdmin} />
    </div>
  )
}

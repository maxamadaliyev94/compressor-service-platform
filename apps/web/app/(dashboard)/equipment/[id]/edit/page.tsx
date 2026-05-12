import { auth } from '@/auth'
import { db } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import EditEquipmentClient from './EditEquipmentClient'

export default async function EditEquipmentPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) redirect('/login')
  if (!['ADMIN', 'MANAGER'].includes(session.user.role)) redirect('/403')

  const equipment = await db.equipment.findUnique({
    where: { id: params.id },
    include: { object: { include: { branch: { include: { client: true } } } } },
  })
  if (!equipment) notFound()

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <a href="/equipment" className="text-gray-400 hover:text-gray-600">
          ← Назад к списку оборудования
        </a>
      </div>
      <h1 className="text-2xl font-bold mb-4">Редактировать оборудование</h1>
      <EditEquipmentClient equipment={JSON.parse(JSON.stringify(equipment))} />
    </div>
  )
}

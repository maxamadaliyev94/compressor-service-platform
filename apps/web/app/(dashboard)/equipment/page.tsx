import { db } from '@/lib/db'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import SearchableEquipment from './SearchableEquipment'
import ExportButton from './ExportButton'

export default async function EquipmentPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const role = session.user.role
  const userId = session.user.id

  let equipment: any[]

  if (role === 'ENGINEER') {
    const taskRows = await db.serviceTask.findMany({
      where: {
        assignedToId: userId,
        status: { in: ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'DRAFT', 'REVIEW'] },
      },
      select: { equipmentId: true },
    })
    const equipmentIds = [...new Set(taskRows.map((t) => t.equipmentId))]
    equipment =
      equipmentIds.length === 0
        ? []
        : await db.equipment.findMany({
            where: { id: { in: equipmentIds } },
            include: {
              object: { include: { branch: { include: { client: true } } } },
              tasks: {
                where: { status: { in: ['NEW', 'ASSIGNED', 'IN_PROGRESS'] } },
                take: 1,
                include: { assignedTo: { select: { name: true } } },
              },
            },
            orderBy: { createdAt: 'desc' },
          })
  } else {
    equipment = await db.equipment.findMany({
      where: {
        object: {
          branch: {
            client: { status: { not: 'PASSIVE' } },
          },
        },
      },
      include: {
        object: { include: { branch: { include: { client: true } } } },
        tasks: {
          where: { status: { in: ['NEW', 'ASSIGNED', 'IN_PROGRESS'] } },
          take: 1,
          include: { assignedTo: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  const serialized = JSON.parse(JSON.stringify(equipment)) as any[]

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Оборудование</h1>
          <p className="text-sm text-gray-500 mt-1">
            {role === 'ENGINEER'
              ? `Моё оборудование — ${equipment.length} единиц по активным задачам`
              : `Всё оборудование — ${equipment.length} единиц`}
          </p>
        </div>
        <div className="flex gap-3">
          {role !== 'ENGINEER' && <ExportButton equipment={serialized} />}
          {role !== 'ENGINEER' && (
            <a
              href="/equipment/new"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
            >
              + Добавить оборудование
            </a>
          )}
        </div>
      </div>
      <SearchableEquipment equipment={serialized} />
    </div>
  )
}

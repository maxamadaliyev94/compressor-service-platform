import { db } from '@/lib/db'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { hasPermission, requirePermission } from '@/lib/permissions'
import type { Role } from '@prisma/client'
import SearchableEquipment from './SearchableEquipment'
import ExportButton from './ExportButton'
import {
  prismaWhereClientEquipment,
  prismaWhereEngineerTaskAssignment,
} from '@/lib/api-access'

export default async function EquipmentPage() {
  await requirePermission('section:equipment')
  const session = await auth()
  if (!session) redirect('/login')
  const role = session.user.role
  const userId = session.user.id
  const canExport = await hasPermission(role as Role, 'action:equipment.export')
  const canCreate = await hasPermission(role as Role, 'action:equipment.create')
  const canViewWarranty = await hasPermission(role as Role, 'field:equipment.warranty')
  const canManageEquipment = role === 'ADMIN' || role === 'MANAGER'

  let equipment: any[]

  if (role === 'ENGINEER') {
    const taskRows = await db.serviceTask.findMany({
      where: {
        deletedAt: null,
        status: { in: ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'DRAFT', 'REVIEW'] },
        ...prismaWhereEngineerTaskAssignment(userId),
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
  } else if (role === 'MANAGER') {
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
  } else if (role === 'CLIENT') {
    equipment = await db.equipment.findMany({
      where: prismaWhereClientEquipment(session.user.clientId),
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

  const managerFilterUI =
    role === 'ADMIN' ? 'admin-dropdown' : role === 'MANAGER' ? 'manager-buttons' : null

  const managerOptions =
    role === 'ADMIN'
      ? await db.user.findMany({
          where: { role: 'MANAGER' },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : []

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-center mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Оборудование</h1>
          <p className="text-sm text-gray-500 mt-1">
            {role === 'ENGINEER'
              ? `Моё оборудование — ${equipment.length} единиц по активным задачам`
              : role === 'MANAGER'
                ? `Оборудование — ${equipment.length} ед. (непассивные клиенты)`
                : role === 'CLIENT'
                  ? `Оборудование вашей организации — ${equipment.length} ед.`
                  : `Всё оборудование — ${equipment.length} единиц`}
          </p>
        </div>
        <div className="flex flex-col w-full md:w-auto md:flex-row gap-2 md:gap-3">
          {canExport && <ExportButton equipment={serialized} />}
          {canCreate && (
            <a
              href="/equipment/new"
              className="w-full md:w-auto min-h-11 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 inline-flex items-center justify-center"
            >
              + Добавить оборудование
            </a>
          )}
        </div>
      </div>
      <SearchableEquipment
        equipment={serialized}
        canViewWarranty={canViewWarranty}
        canManageEquipment={canManageEquipment}
        managerFilterUI={managerFilterUI}
        currentUserId={userId}
        managerOptions={managerOptions}
      />
    </div>
  )
}

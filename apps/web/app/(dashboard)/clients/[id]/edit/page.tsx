import { db } from '@/lib/db'
import { auth } from '@/auth'
import { notFound } from 'next/navigation'
import EditClientForm from './EditClientForm'

export default async function EditClientPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) notFound()
  const role = session.user.role
  if (!['ADMIN', 'MANAGER'].includes(role)) notFound()

  const client = await db.client.findUnique({ where: { id: params.id } })
  if (!client) notFound()

  return (
    <EditClientForm
      client={{
        id: client.id,
        name: client.name,
        inn: client.inn,
        contactPerson: client.contactPerson,
        phone: client.phone,
        email: client.email,
        status: client.status,
        country: client.country,
        city: client.city,
        comment: client.comment,
      }}
    />
  )
}

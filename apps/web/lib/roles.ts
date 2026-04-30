import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export type UserRole = 'ADMIN' | 'MANAGER' | 'CHIEF_ENGINEER' | 'ENGINEER' | 'CLIENT'

export async function requireRole(...roles: UserRole[]) {
  const session = await auth()
  if (!session) redirect('/login')
  if (!roles.includes(session.user.role as UserRole)) {
    redirect('/403')
  }
  return session
}

export async function getSession() {
  const session = await auth()
  if (!session) redirect('/login')
  return session
}

export function canAccess(role: string, resource: string): boolean {
  const permissions: Record<string, string[]> = {
    ADMIN: ['*'],
    MANAGER: ['clients', 'equipment', 'tasks', 'reports', 'map'],
    CHIEF_ENGINEER: ['equipment', 'tasks', 'reports', 'map'],
    ENGINEER: ['tasks.own'],
    CLIENT: ['own'],
  }
  const perms = permissions[role] || []
  return perms.includes('*') || perms.includes(resource) || perms.some((p) => resource.startsWith(p))
}

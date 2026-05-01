import { db } from '@/lib/db'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import type { Role } from '@prisma/client'

const CACHE_TTL_MS = 30_000
const rolePermissionCache = new Map<string, { expiresAt: number; allowed: Set<string> }>()

type PermissionRow = { key: string; allowed: boolean }

const LEGACY_ROLE_PERMISSIONS: Record<Role, string[]> = {
  ADMIN: ['*'],
  MANAGER: [
    'section:dashboard',
    'section:clients',
    'section:equipment',
    'section:tasks',
    'section:reports',
    'section:map',
    'section:references',
    'action:task.create',
    'action:task.assign',
    'action:equipment.create',
    'action:equipment.export',
    'field:user.phone',
    'field:equipment.warranty',
    'field:task.internalComment',
  ],
  CHIEF_ENGINEER: [
    'section:dashboard',
    'section:equipment',
    'section:tasks',
    'section:reports',
    'section:map',
    'action:task.create',
    'action:task.assign',
    'action:task.close',
    'field:user.phone',
    'field:equipment.warranty',
    'field:task.internalComment',
  ],
  ENGINEER: [
    'section:dashboard',
    'section:equipment',
    'section:tasks',
    'action:task.close',
    'field:equipment.warranty',
  ],
  CLIENT: [],
}

async function loadRolePermissions(role: Role): Promise<Set<string>> {
  const cacheKey = role
  const now = Date.now()
  const cached = rolePermissionCache.get(cacheKey)
  if (cached && cached.expiresAt > now) {
    return cached.allowed
  }

  let allowed: Set<string>
  try {
    const rows = (await db.$queryRaw`
      SELECT p."key", rp."allowed"
      FROM "role_permissions" rp
      INNER JOIN "permissions" p ON p."id" = rp."permissionId"
      WHERE rp."role" = CAST(${role} AS "Role")
    `) as PermissionRow[]
    const allowedKeys = rows.filter((r) => r.allowed).map((r) => r.key)
    if (allowedKeys.length === 0) {
      // If RBAC tables exist but role has no rows/permissions yet, keep app usable with defaults.
      const fallback = LEGACY_ROLE_PERMISSIONS[role] ?? []
      allowed = new Set(fallback)
      console.warn(`RBAC fallback active: no allowed permissions found for role ${role}`)
    } else {
      allowed = new Set(allowedKeys)
    }
  } catch {
    // Fallback, if RBAC tables are not migrated yet.
    const fallback = LEGACY_ROLE_PERMISSIONS[role] ?? []
    allowed = new Set(fallback)
    console.warn('RBAC fallback active: role_permissions/permissions are unavailable')
  }

  rolePermissionCache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, allowed })
  return allowed
}

export async function hasPermission(role: Role, key: string): Promise<boolean> {
  if (role === 'ADMIN') return true
  const allowed = await loadRolePermissions(role)
  return allowed.has(key)
}

export async function requirePermission(key: string) {
  const session = await auth()
  if (!session) redirect('/login')
  const role = session.user.role as Role
  const permitted = await hasPermission(role, key)
  if (!permitted) redirect('/403')
  return session
}

export async function getSessionPermissions() {
  const session = await auth()
  if (!session) return { session: null, permissions: new Set<string>() }
  const role = session.user.role as Role
  const permissions = role === 'ADMIN' ? new Set<string>(['*']) : await loadRolePermissions(role)
  return { session, permissions }
}

export function clearPermissionCache() {
  rolePermissionCache.clear()
}

import { db } from '@/lib/db'
import { auth } from '@/auth'
import { logUserActivity, UserActivityAction } from '@/lib/user-activity-log'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_DEFINITIONS } from '@/lib/rbac-defaults'
import { clearPermissionCache } from '@/lib/permissions'

const ROLES = ['ADMIN', 'MANAGER', 'CHIEF_ENGINEER', 'ENGINEER', 'CLIENT'] as const

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as { role?: string }
  const requestedRole = body.role
  if (requestedRole && !ROLES.includes(requestedRole as (typeof ROLES)[number])) {
    return NextResponse.json({ error: 'Некорректная роль' }, { status: 400 })
  }
  const rolesToReset = requestedRole
    ? [requestedRole as (typeof ROLES)[number]]
    : [...ROLES]

  for (const def of PERMISSION_DEFINITIONS) {
    const id = `perm_${randomUUID()}`
    await db.$executeRaw`
      INSERT INTO "permissions" ("id", "key", "category", "label", "description", "createdAt")
      VALUES (${id}, ${def.key}, ${def.category}, ${def.label}, ${def.description ?? null}, NOW())
      ON CONFLICT ("key") DO UPDATE
      SET "category" = EXCLUDED."category",
          "label" = EXCLUDED."label",
          "description" = EXCLUDED."description"
    `
  }

  const permissionRows = (await db.$queryRaw`
    SELECT "id", "key" FROM "permissions"
  `) as Array<{ id: string; key: string }>

  for (const role of rolesToReset) {
    const allowedSet = new Set(DEFAULT_ROLE_PERMISSIONS[role] || [])
    for (const row of permissionRows) {
      const rpId = `rp_${randomUUID()}`
      const allowed = allowedSet.has(row.key)
      await db.$executeRaw`
        INSERT INTO "role_permissions" ("id", "role", "permissionId", "allowed", "updatedById", "createdAt", "updatedAt")
        VALUES (${rpId}, CAST(${role} AS "Role"), ${row.id}, ${allowed}, ${session.user.id}, NOW(), NOW())
        ON CONFLICT ("role", "permissionId") DO UPDATE
        SET "allowed" = EXCLUDED."allowed",
            "updatedById" = EXCLUDED."updatedById",
            "updatedAt" = NOW()
      `
    }
  }

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'RESET_ROLE_PERMISSIONS',
      entity: 'AccessControl',
      entityId: requestedRole ?? 'roles',
      comment: requestedRole
        ? `RBAC defaults restored for role ${requestedRole}`
        : 'RBAC matrix reset to defaults',
    },
  })

  await logUserActivity(session.user.id, UserActivityAction.ACCESS_RESET, req, {
    page: '/access',
    metadata: { role: requestedRole ?? 'all' },
  })

  clearPermissionCache()
  return NextResponse.json({ ok: true, role: requestedRole ?? null })
}

import { db } from '@/lib/db'
import { auth } from '@/auth'
import { logUserActivity, UserActivityAction } from '@/lib/user-activity-log'
import { NextRequest, NextResponse } from 'next/server'
import { clearPermissionCache } from '@/lib/permissions'
import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_DEFINITIONS } from '@/lib/rbac-defaults'
import { randomUUID } from 'crypto'

const ROLES = ['ADMIN', 'MANAGER', 'CHIEF_ENGINEER', 'ENGINEER', 'CLIENT'] as const

async function ensureAdmin() {
  const session = await auth()
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (session.user.role !== 'ADMIN') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { session }
}

export async function GET() {
  const guard = await ensureAdmin()
  if (guard.error) return guard.error
  const session = guard.session!

  let permissions = (await db.$queryRaw`
    SELECT "id", "key", "category", "label", "description"
    FROM "permissions"
    ORDER BY "category" ASC, "key" ASC
  `) as Array<{
    id: string
    key: string
    category: string
    label: string
    description: string | null
  }>

  if (permissions.length === 0) {
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

    for (const role of ROLES) {
      const allowedSet = new Set(DEFAULT_ROLE_PERMISSIONS[role] || [])
      for (const row of permissionRows) {
        const rolePermissionId = `rp_${randomUUID()}`
        const allowed = allowedSet.has(row.key)
        await db.$executeRaw`
          INSERT INTO "role_permissions" ("id", "role", "permissionId", "allowed", "updatedById", "createdAt", "updatedAt")
          VALUES (${rolePermissionId}, CAST(${role} AS "Role"), ${row.id}, ${allowed}, ${session.user.id}, NOW(), NOW())
          ON CONFLICT ("role", "permissionId") DO UPDATE
          SET "allowed" = EXCLUDED."allowed",
              "updatedById" = EXCLUDED."updatedById",
              "updatedAt" = NOW()
        `
      }
    }

    permissions = (await db.$queryRaw`
      SELECT "id", "key", "category", "label", "description"
      FROM "permissions"
      ORDER BY "category" ASC, "key" ASC
    `) as Array<{
      id: string
      key: string
      category: string
      label: string
      description: string | null
    }>
  }

  const rows = (await db.$queryRaw`
    SELECT rp."role", p."key", rp."allowed"
    FROM "role_permissions" rp
    INNER JOIN "permissions" p ON p."id" = rp."permissionId"
  `) as Array<{ role: string; key: string; allowed: boolean }>

  const matrix: Record<string, Record<string, boolean>> = {}
  for (const role of ROLES) matrix[role] = {}
  for (const row of rows) {
    if (!matrix[row.role]) matrix[row.role] = {}
    matrix[row.role][row.key] = row.allowed
  }

  return NextResponse.json({ permissions, matrix, roles: ROLES })
}

export async function PATCH(req: NextRequest) {
  const guard = await ensureAdmin()
  if (guard.error) return guard.error
  const session = guard.session!

  const body = (await req.json()) as {
    updates?: Array<{ role: string; key: string; allowed: boolean }>
  }
  const updates = Array.isArray(body.updates) ? body.updates : []
  if (updates.length === 0) {
    return NextResponse.json({ error: 'Нет изменений' }, { status: 400 })
  }

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

  for (const update of updates) {
    if (!ROLES.includes(update.role as (typeof ROLES)[number])) continue
    const permission = (await db.$queryRaw`
      SELECT "id" FROM "permissions" WHERE "key" = ${update.key} LIMIT 1
    `) as Array<{ id: string }>
    if (!permission[0]) continue
    const rolePermissionId = `rp_${randomUUID()}`
    await db.$executeRaw`
      INSERT INTO "role_permissions" ("id", "role", "permissionId", "allowed", "updatedById", "createdAt", "updatedAt")
      VALUES (${rolePermissionId}, CAST(${update.role} AS "Role"), ${permission[0].id}, ${update.allowed}, ${session.user.id}, NOW(), NOW())
      ON CONFLICT ("role", "permissionId") DO UPDATE
      SET "allowed" = EXCLUDED."allowed",
          "updatedById" = EXCLUDED."updatedById",
          "updatedAt" = NOW()
    `
  }

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'UPDATE_ROLE_PERMISSIONS',
      entity: 'AccessControl',
      entityId: 'roles',
      newValue: JSON.stringify(updates),
    },
  })

  await logUserActivity(session.user.id, UserActivityAction.ACCESS_MATRIX_EDIT, req, {
    page: '/access',
    metadata: { updates: updates.length },
  })

  clearPermissionCache()
  return NextResponse.json({ ok: true })
}

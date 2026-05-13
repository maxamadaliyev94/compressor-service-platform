import type { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getClientIp } from '@/lib/client-ip'

export const UserActivityAction = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  TASK_CREATE: 'TASK_CREATE',
  TASK_EDIT: 'TASK_EDIT',
  TASK_DELETE: 'TASK_DELETE',
  TASK_TRASH_PURGE: 'TASK_TRASH_PURGE',
  ACT_COMPLETE: 'ACT_COMPLETE',
  CLIENT_EDIT: 'CLIENT_EDIT',
  CLIENT_DELETE: 'CLIENT_DELETE',
  CLIENT_ADMIN_PATCH: 'CLIENT_ADMIN_PATCH',
  EQUIPMENT_EDIT: 'EQUIPMENT_EDIT',
  EQUIPMENT_DELETE: 'EQUIPMENT_DELETE',
  EQUIPMENT_PHOTOS: 'EQUIPMENT_PHOTOS',
  EQUIPMENT_HOURS: 'EQUIPMENT_HOURS',
  EQUIPMENT_COMMENT: 'EQUIPMENT_COMMENT',
  ACCESS_MATRIX_EDIT: 'ACCESS_MATRIX_EDIT',
  ACCESS_RESET: 'ACCESS_RESET',
} as const

export type UserActivityActionType = (typeof UserActivityAction)[keyof typeof UserActivityAction]

export const USER_ACTIVITY_LABELS: Record<string, string> = {
  LOGIN: 'Вход в систему',
  LOGOUT: 'Выход',
  TASK_CREATE: 'Создание задачи',
  TASK_EDIT: 'Изменение задачи',
  TASK_DELETE: 'Удаление задачи (в корзину)',
  TASK_TRASH_PURGE: 'Окончательное удаление из корзины',
  ACT_COMPLETE: 'Создание / завершение акта (отчёта)',
  CLIENT_EDIT: 'Редактирование клиента',
  CLIENT_DELETE: 'Удаление клиента',
  CLIENT_ADMIN_PATCH: 'Изменение статуса клиента (админ)',
  EQUIPMENT_EDIT: 'Редактирование оборудования',
  EQUIPMENT_DELETE: 'Удаление оборудования',
  EQUIPMENT_PHOTOS: 'Изменение фото оборудования',
  EQUIPMENT_HOURS: 'Изменение моточасов',
  EQUIPMENT_COMMENT: 'Комментарий к оборудованию',
  ACCESS_MATRIX_EDIT: 'Изменение матрицы доступа',
  ACCESS_RESET: 'Сброс прав доступа',
}

export async function logUserActivity(
  userId: string,
  action: string,
  req: NextRequest,
  opts?: { page?: string | null; metadata?: Record<string, unknown> | null },
): Promise<void> {
  try {
    const ip = getClientIp(req)
    const userAgent = req.headers.get('user-agent') ?? null
    await db.userActivity.create({
      data: {
        userId,
        action,
        page: opts?.page ?? null,
        ip,
        userAgent,
        metadata:
          opts?.metadata === undefined || opts?.metadata === null
            ? undefined
            : (opts.metadata as Prisma.InputJsonValue),
      },
    })
  } catch (e) {
    console.error('[logUserActivity]', action, e)
  }
}

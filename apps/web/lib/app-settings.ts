import { db } from '@/lib/db'

/** Глобальный переключатель доступности приложения (middleware + вход). */
export async function isGloballyActive(): Promise<boolean> {
  const row = await db.appSettings.findUnique({ where: { id: 'default' } })
  return row?.isActive !== false
}

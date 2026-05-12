import { computeGloballyAccessible } from '@/lib/access-policy'
import { db } from '@/lib/db'

/** Доступ в приложение (middleware + NextAuth): свежая строка из БД, без кэша. */
export async function isGloballyActive(): Promise<boolean> {
  const row = await db.appSettings.findUnique({ where: { id: 'default' } })
  return computeGloballyAccessible(
    row
      ? { isActive: row.isActive, subscriptionEnd: row.subscriptionEnd }
      : null,
  )
}

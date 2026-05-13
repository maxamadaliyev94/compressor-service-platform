import { db } from '@/lib/db'
import { parseDelegationParentTaskId } from '@/lib/task-delegation'

/**
 * После загрузки задач для ЛК клиента:
 * — строки с deletedAt (на случай рассинхрона);
 * — дочерние задачи «Распределено ГИ из задачи …», если родитель удалён (в корзину), окончательно удалён или отсутствует.
 */
export async function sanitizeTasksForClientPortal<
  T extends { id: string; comment: string | null; deletedAt: Date | null },
>(tasks: T[]): Promise<T[]> {
  const notTrash = tasks.filter((t) => t.deletedAt == null)

  const parentIds = [
    ...new Set(
      notTrash.map((t) => parseDelegationParentTaskId(t.comment)).filter((id): id is string => Boolean(id))
    ),
  ]
  if (parentIds.length === 0) return notTrash

  const parents = await db.serviceTask.findMany({
    where: { id: { in: parentIds } },
    select: { id: true, deletedAt: true },
  })
  const activeParentIds = new Set(parents.filter((p) => p.deletedAt == null).map((p) => p.id))

  return notTrash.filter((t) => {
    const pid = parseDelegationParentTaskId(t.comment)
    if (!pid) return true
    return activeParentIds.has(pid)
  })
}

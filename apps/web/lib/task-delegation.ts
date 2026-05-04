/** ID родительской задачи из комментария «Распределено ГИ из задачи …». */
export function parseDelegationParentTaskId(comment: string | null | undefined): string | null {
  if (!comment) return null
  const m = comment.match(/\[Распределено ГИ из задачи ([^\]]+)\]/)
  return m?.[1]?.trim() || null
}

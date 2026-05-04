'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type WorkType = 'QUICK' | 'LONG_TERM'

export default function TaskChiefWorkTypePanel({
  taskId,
  taskType,
  canEdit,
  hasDailyEntries,
}: {
  taskId: string
  taskType: WorkType
  canEdit: boolean
  hasDailyEntries: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [local, setLocal] = useState<WorkType>(taskType)

  useEffect(() => {
    setLocal(taskType)
  }, [taskType])

  async function apply(next: WorkType) {
    if (next === local || busy) return
    if (next === 'QUICK' && hasDailyEntries) {
      alert('Уже есть записи дневника — нельзя вернуть «быструю»')
      return
    }
    setBusy(true)
    const r = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskType: next }),
    })
    setBusy(false)
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      alert((d as { error?: string }).error || 'Не удалось сохранить')
      return
    }
    setLocal(next)
    router.refresh()
  }

  if (!canEdit) {
    return (
      <div className="flex gap-2">
        <span className="text-gray-500 w-28 shrink-0">Формат:</span>
        <span>{taskType === 'LONG_TERM' ? 'Долгосрочная' : 'Быстрая'}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
      <span className="text-gray-500 w-28 shrink-0 text-sm pt-0.5">Формат:</span>
      <div className="flex flex-col gap-2 text-sm min-w-0">
        <p className="text-gray-600 text-xs leading-snug">
          Как будет вестись работа — быстрый цикл с актом инженера или долгосрочно с дневным журналом и закрытием вами.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="chief-task-work-type"
              checked={local === 'QUICK'}
              disabled={busy || (taskType === 'LONG_TERM' && hasDailyEntries)}
              onChange={() => void apply('QUICK')}
              className="accent-indigo-600"
            />
            <span>Быстрая</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="chief-task-work-type"
              checked={local === 'LONG_TERM'}
              disabled={busy}
              onChange={() => void apply('LONG_TERM')}
              className="accent-indigo-600"
            />
            <span>Долгосрочная</span>
          </label>
        </div>
      </div>
    </div>
  )
}

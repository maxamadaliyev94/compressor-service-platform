'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ActSignaturePad from './execute/ActSignaturePad'

type UserRow = { id: string; name: string; role: string; isActive?: boolean }

export default function TaskLongTermChiefPanel({
  taskId,
  initialAssigneeId,
  equipmentCurrentHours,
  equipmentNextServiceHours,
}: {
  taskId: string
  initialAssigneeId: string
  equipmentCurrentHours: number
  equipmentNextServiceHours: number | null
}) {
  const router = useRouter()
  const [users, setUsers] = useState<UserRow[]>([])
  const [assigneeId, setAssigneeId] = useState(initialAssigneeId)
  const [assignBusy, setAssignBusy] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const [completeBusy, setCompleteBusy] = useState(false)
  const [currentHours, setCurrentHours] = useState(String(equipmentCurrentHours))
  const [nextServiceHours, setNextServiceHours] = useState(
    String(equipmentNextServiceHours ?? equipmentCurrentHours + 2000)
  )
  const [chiefNotes, setChiefNotes] = useState('')
  const [recommendations, setRecommendations] = useState('')
  const [engineerSignature, setEngineerSignature] = useState<string | null>(null)
  const [engineerSignedAt, setEngineerSignedAt] = useState<Date | null>(null)

  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then((data: UserRow[]) => {
        const list = Array.isArray(data) ? data : []
        setUsers(list.filter((u) => u.role === 'ENGINEER' && (u.isActive !== false)))
      })
  }, [])

  useEffect(() => {
    setAssigneeId(initialAssigneeId)
  }, [initialAssigneeId])

  async function saveAssignee() {
    if (!assigneeId) {
      alert('Выберите инженера')
      return
    }
    setAssignBusy(true)
    const r = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedToId: assigneeId }),
    })
    setAssignBusy(false)
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      alert((d as { error?: string }).error || 'Не удалось назначить')
      return
    }
    router.refresh()
  }

  async function submitComplete() {
    if (!engineerSignature || !engineerSignedAt) {
      alert('Нужна подпись на форме завершения')
      return
    }
    const ch = parseInt(currentHours, 10)
    const nh = parseInt(nextServiceHours, 10)
    if (!Number.isFinite(ch) || !Number.isFinite(nh)) {
      alert('Проверьте моточасы')
      return
    }
    setCompleteBusy(true)
    const r = await fetch(`/api/tasks/${taskId}/complete-long-term`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentHours: ch,
        nextServiceHours: nh,
        chiefNotes: chiefNotes.trim() || undefined,
        recommendations: recommendations.trim() || undefined,
        engineerSignature,
        engineerSignedAt: engineerSignedAt.toISOString(),
      }),
    })
    setCompleteBusy(false)
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      alert((d as { error?: string }).error || 'Не удалось закрыть задачу')
      return
    }
    setShowComplete(false)
    router.refresh()
  }

  return (
    <div className="bg-violet-50 border border-violet-200 rounded-xl p-5 mb-6 space-y-4">
      <h2 className="font-semibold text-violet-900">Долгосрочная задача — управление</h2>
      <p className="text-sm text-violet-800">
        Назначьте или смените исполнителя. По завершении всех работ закройте задачу — будет сформирован сводный акт с
        журналом по дням.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <label className="flex-1 text-sm">
          <span className="text-gray-600 block mb-1">Инженер</span>
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">— выберите —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={assignBusy}
          onClick={() => void saveAssignee()}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {assignBusy ? '…' : 'Назначить / сменить'}
        </button>
      </div>
      <div className="pt-2 border-t border-violet-200">
        <button
          type="button"
          onClick={() => setShowComplete((v) => !v)}
          className="w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700"
        >
          Завершить долгосрочную задачу
        </button>
      </div>
      {showComplete && (
        <div className="rounded-lg border border-violet-200 bg-white p-4 space-y-3 text-sm">
          <p className="text-gray-600">
            Укажите итоговые моточасы и подпишите акт. В отчёт войдут все записи из дневного журнала.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label>
              <span className="text-gray-500 text-xs block mb-0.5">Текущие моточасы</span>
              <input
                type="number"
                value={currentHours}
                onChange={(e) => setCurrentHours(e.target.value)}
                className="w-full border rounded px-2 py-1"
              />
            </label>
            <label>
              <span className="text-gray-500 text-xs block mb-0.5">Следующее ТО (м/ч)</span>
              <input
                type="number"
                value={nextServiceHours}
                onChange={(e) => setNextServiceHours(e.target.value)}
                className="w-full border rounded px-2 py-1"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-gray-500 text-xs block mb-0.5">Комментарий главного инженера (в акт)</span>
            <textarea
              value={chiefNotes}
              onChange={(e) => setChiefNotes(e.target.value)}
              rows={2}
              className="w-full border rounded px-2 py-1"
              placeholder="Итоги работ, замечания…"
            />
          </label>
          <label className="block">
            <span className="text-gray-500 text-xs block mb-0.5">Рекомендации клиенту</span>
            <textarea
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
              rows={2}
              className="w-full border rounded px-2 py-1"
            />
          </label>
          <ActSignaturePad
            variant="engineer"
            title="Подпись главного инженера"
            signedDataUrl={engineerSignature}
            signedAt={engineerSignedAt}
            onSigned={(dataUrl, at) => {
              setEngineerSignature(dataUrl)
              setEngineerSignedAt(at)
            }}
            onReset={() => {
              setEngineerSignature(null)
              setEngineerSignedAt(null)
            }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={completeBusy}
              onClick={() => void submitComplete()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >
              {completeBusy ? 'Сохранение…' : 'Подтвердить и закрыть'}
            </button>
            <button
              type="button"
              onClick={() => setShowComplete(false)}
              className="px-4 py-2 rounded-lg text-sm border border-gray-300"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

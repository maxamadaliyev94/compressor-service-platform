'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ActSignaturePad from './execute/ActSignaturePad'

type UserRow = { id: string; name: string; role: string; isActive?: boolean }

export default function TaskLongTermChiefPanel({
  taskId,
  initialEngineerIds,
  initialAssignedEngineers,
  equipmentCurrentHours,
  equipmentNextServiceHours,
}: {
  taskId: string
  initialEngineerIds: string[]
  initialAssignedEngineers: { id: string; name: string }[]
  equipmentCurrentHours: number
  equipmentNextServiceHours: number | null
}) {
  const router = useRouter()
  const [users, setUsers] = useState<UserRow[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>(() => [...initialEngineerIds])
  const [assignEditOpen, setAssignEditOpen] = useState(() => initialEngineerIds.length === 0)
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
    setSelectedIds([...initialEngineerIds])
  }, [initialEngineerIds])

  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then((data: UserRow[] | { error?: string }) => {
        const list = Array.isArray(data) ? data : []
        setUsers(list.filter((u) => u.role === 'ENGINEER' && u.isActive !== false))
      })
  }, [])

  useEffect(() => {
    if (users.length === 0) return
    const allowed = new Set(users.map((u) => u.id))
    setSelectedIds(initialEngineerIds.filter((id) => allowed.has(id)))
  }, [users, initialEngineerIds])

  const summaryNames =
    initialAssignedEngineers.length > 0
      ? initialAssignedEngineers.map((e) => e.name).join(', ')
      : 'Никого не назначено'

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function saveEngineers() {
    if (selectedIds.length === 0) {
      if (!confirm('Снять всех инженеров с задачи?')) return
    }
    setAssignBusy(true)
    const allowed = new Set(users.map((u) => u.id))
    const engineerIds = [...new Set(selectedIds)].filter((id) => allowed.has(id))
    const r = await fetch(`/api/tasks/${taskId}/long-term-engineers`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engineerIds }),
    })
    setAssignBusy(false)
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      alert((d as { error?: string }).error || 'Не удалось сохранить назначение')
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <h2 className="font-semibold text-violet-900">Долгосрочная задача — управление</h2>
        <div className="flex flex-wrap gap-2 shrink-0">
          {!assignEditOpen ? (
            <button
              type="button"
              onClick={() => setAssignEditOpen(true)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-violet-400 text-violet-900 bg-white hover:bg-violet-100"
            >
              Редактировать назначение
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setAssignEditOpen(false)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
            >
              Свернуть
            </button>
          )}
        </div>
      </div>
      <p className="text-sm text-violet-800">
        Назначьте одного или нескольких исполнителей. По завершении всех работ закройте задачу — будет сформирован
        сводный акт с журналом по дням.
      </p>

      {!assignEditOpen && (
        <div className="rounded-lg border border-violet-200 bg-white/80 px-3 py-2 text-sm text-gray-800">
          <span className="text-gray-500">Назначены: </span>
          {summaryNames}
        </div>
      )}

      {assignEditOpen &&
        (users.length === 0 ? (
          <p className="text-sm text-gray-500">Загрузка списка инженеров…</p>
        ) : (
          <>
            <div>
              <span className="text-gray-600 text-sm block mb-2">Инженеры</span>
              <div className="border rounded-lg bg-white p-3 max-h-48 overflow-y-auto space-y-2">
                {users.map((u) => (
                  <label key={u.id} className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(u.id)}
                      onChange={() => toggle(u.id)}
                      className="w-4 h-4 mt-0.5 accent-violet-600 shrink-0"
                    />
                    <span className="text-gray-900">{u.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <button
                type="button"
                disabled={assignBusy}
                onClick={() => void saveEngineers()}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {assignBusy ? 'Сохранение…' : `Сохранить назначение (${selectedIds.length})`}
              </button>
            </div>
          </>
        ))}

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

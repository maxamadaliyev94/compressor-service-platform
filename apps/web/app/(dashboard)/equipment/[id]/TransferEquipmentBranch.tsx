'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type BranchOption = { id: string; name: string }
type ClientOption = { id: string; name: string }

export default function TransferEquipmentBranch({
  equipmentId,
  currentClientId,
  currentBranchId,
  currentBranchName,
}: {
  equipmentId: string
  currentClientId: string
  currentBranchId: string
  currentBranchName: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [selectedClientId, setSelectedClientId] = useState(currentClientId)
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [comment, setComment] = useState('')

  useEffect(() => {
    if (!open) return
    setSelectedClientId(currentClientId)
    setSelectedBranchId('')
    setComment('')
    setLoadingData(true)
    fetch('/api/clients')
      .then((res) => (res.ok ? res.json() : []))
      .then((list: ClientOption[]) => setClients(Array.isArray(list) ? list : []))
      .catch(() => setClients([]))
      .finally(() => setLoadingData(false))
  }, [open, currentClientId])

  useEffect(() => {
    if (!open || !selectedClientId) {
      setBranches([])
      return
    }
    setLoadingData(true)
    fetch(`/api/branches?clientId=${selectedClientId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((list: BranchOption[]) => {
        const items = Array.isArray(list) ? list : []
        setBranches(items.filter((b) => b.id !== currentBranchId))
        setSelectedBranchId((prev) => {
          if (prev && items.some((b) => b.id === prev && b.id !== currentBranchId)) return prev
          const first = items.find((b) => b.id !== currentBranchId)
          return first?.id ?? ''
        })
      })
      .catch(() => setBranches([]))
      .finally(() => setLoadingData(false))
  }, [open, selectedClientId, currentBranchId])

  const selectedBranch = useMemo(
    () => branches.find((b) => b.id === selectedBranchId),
    [branches, selectedBranchId],
  )

  async function handleConfirm() {
    if (!selectedBranchId) {
      alert('Выберите филиал назначения')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/equipment/${equipmentId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: selectedBranchId,
          comment: comment.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert((data as { error?: string }).error ?? 'Не удалось перенести оборудование')
        return
      }
      setOpen(false)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
        title="Перенести на другой филиал"
      >
        ↔ Перенести на другой филиал
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-2">Перенос оборудования</h2>
            <p className="text-sm text-gray-600 mb-4">
              Сейчас: <span className="font-medium text-gray-900">«{currentBranchName}»</span>
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Организация</label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  disabled={loadingData}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Филиал назначения</label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  disabled={loadingData || branches.length === 0}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  {branches.length === 0 ? (
                    <option value="">Нет других филиалов</option>
                  ) : (
                    branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))
                  )}
                </select>
                {selectedBranch && (
                  <p className="text-xs text-gray-500 mt-1">→ {selectedBranch.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Комментарий (необязательно)</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  placeholder="Причина переноса..."
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={loading || loadingData || !selectedBranchId}
                onClick={() => void handleConfirm()}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Перенос…' : 'Перенести'}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => setOpen(false)}
                className="flex-1 border py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

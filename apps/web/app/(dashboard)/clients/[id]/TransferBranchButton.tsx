'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type ClientOption = { id: string; name: string }

export default function TransferBranchButton({
  branchId,
  branchName,
  currentClientId,
}: {
  branchId: string
  branchName: string
  currentClientId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingClients, setLoadingClients] = useState(false)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  async function openModal() {
    setOpen(true)
    setQuery('')
    setSelectedId(null)
    setLoadingClients(true)
    try {
      const res = await fetch('/api/clients')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert((data as { error?: string }).error ?? 'Не удалось загрузить список клиентов')
        setOpen(false)
        return
      }
      const list = (await res.json()) as { id: string; name: string }[]
      setClients(list.filter((c) => c.id !== currentClientId))
    } finally {
      setLoadingClients(false)
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) => c.name.toLowerCase().includes(q))
  }, [clients, query])

  async function handleConfirm() {
    if (!selectedId) {
      alert('Выберите организацию')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/branches/${branchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: selectedId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert((data as { error?: string }).error ?? 'Не удалось перенести филиал')
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
        onClick={() => void openModal()}
        className="text-xs text-blue-600 hover:text-blue-800 hover:underline px-1 py-0.5 rounded inline-flex items-center gap-1"
        title="Перенести филиал в другую организацию"
      >
        <span aria-hidden>↔</span>
        Перенести
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl max-h-[90vh] flex flex-col">
            <h2 className="text-lg font-bold mb-2">Перенести филиал</h2>
            <p className="text-sm text-gray-600 mb-4">
              Выберите организацию, к которой привязать филиал{' '}
              <span className="font-medium text-gray-900">«{branchName}»</span>.
            </p>

            <label className="block text-sm font-medium mb-1">Поиск по названию</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Начните вводить название..."
              disabled={loadingClients}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
            />

            <div className="flex-1 min-h-[180px] max-h-[40vh] overflow-y-auto border rounded-lg divide-y mb-4">
              {loadingClients ? (
                <div className="p-4 text-sm text-gray-500 text-center">Загрузка…</div>
              ) : filtered.length === 0 ? (
                <div className="p-4 text-sm text-gray-500 text-center">
                  {clients.length === 0 ? 'Нет других доступных организаций' : 'Ничего не найдено'}
                </div>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                      selectedId === c.id ? 'bg-blue-50 text-blue-900 font-medium' : ''
                    }`}
                  >
                    {c.name}
                  </button>
                ))
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                disabled={loading || loadingClients || !selectedId}
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

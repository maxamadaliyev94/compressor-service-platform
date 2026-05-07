'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ClearHistoryButton({ equipmentId }: { equipmentId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function clearHistory() {
    const ok = window.confirm(
      'Очистить всю историю обслуживания этого оборудования? Действие нельзя отменить.'
    )
    if (!ok) return

    setLoading(true)
    try {
      const res = await fetch(`/api/equipment/${equipmentId}/history`, { method: 'DELETE' })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        alert(data?.error || 'Не удалось очистить историю обслуживания')
        return
      }
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={clearHistory}
      disabled={loading}
      className="min-h-9 px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs hover:bg-red-50 disabled:opacity-50"
    >
      {loading ? 'Очистка...' : 'Очистить историю'}
    </button>
  )
}

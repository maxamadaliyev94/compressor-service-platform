'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import ActSignaturePad from './execute/ActSignaturePad'

export default function ClientSignaturePanel({ taskId }: { taskId: string }) {
  const router = useRouter()
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [signedAt, setSignedAt] = useState<Date | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!signedUrl) {
      alert('Сначала нажмите «Подписать» в поле подписи клиента')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/client-signature`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientSignature: signedUrl }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert((data as { error?: string }).error ?? 'Не удалось сохранить подпись')
        return
      }
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white border rounded-xl p-5 space-y-4">
      <h2 className="font-semibold">Подпись клиента</h2>
      <p className="text-xs text-gray-500">
        Подпись можно поставить позже (на объекте или при следующей встрече). После сохранения акт будет полностью подписан.
      </p>
      <ActSignaturePad
        variant="client"
        title="Подпись клиента"
        signedDataUrl={signedUrl}
        signedAt={signedAt}
        onSigned={(url, at) => {
          setSignedUrl(url)
          setSignedAt(at)
        }}
        onReset={() => {
          setSignedUrl(null)
          setSignedAt(null)
        }}
      />
      <button
        type="button"
        onClick={() => void submit()}
        disabled={saving || !signedUrl}
        className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Сохранение...' : 'Сохранить подпись клиента в акт'}
      </button>
    </div>
  )
}

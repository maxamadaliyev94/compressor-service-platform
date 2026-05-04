'use client'

import { webAuthnUserVisibleError } from '@/lib/webauthn-client-error'
import { startRegistration } from '@simplewebauthn/browser'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function RegisterFaceIdButton({
  userId,
  disabled,
  compact,
}: {
  userId: string
  disabled?: boolean
  compact?: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function register() {
    setMessage(null)
    setLoading(true)
    try {
      const optRes = await fetch('/api/webauthn/register/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!optRes.ok) {
        const err = await optRes.json().catch(() => ({}))
        setMessage({ type: 'err', text: (err as { error?: string }).error || 'Не удалось начать регистрацию' })
        return
      }
      const { options, challengeToken } = (await optRes.json()) as {
        options: Parameters<typeof startRegistration>[0]['optionsJSON']
        challengeToken: string
      }
      const attResp = await startRegistration({ optionsJSON: options })
      const verifyRes = await fetch('/api/webauthn/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: attResp, challengeToken }),
      })
      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}))
        setMessage({ type: 'err', text: (err as { error?: string }).error || 'Проверка не пройдена' })
        return
      }
      setMessage({ type: 'ok', text: 'Face ID / биометрия сохранены' })
      router.refresh()
    } catch (e) {
      setMessage({ type: 'err', text: webAuthnUserVisibleError(e) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={compact ? '' : 'space-y-1'}>
      <button
        type="button"
        onClick={register}
        disabled={disabled || loading}
        className={
          compact
            ? 'text-xs text-gray-500 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors disabled:opacity-50'
            : 'w-full min-h-11 border border-blue-200 text-blue-700 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-50'
        }
      >
        {loading ? 'Запрос…' : '📱 Зарегистрировать Face ID'}
      </button>
      {message && (
        <p className={`text-xs ${message.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{message.text}</p>
      )}
    </div>
  )
}

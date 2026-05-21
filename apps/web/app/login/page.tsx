'use client'
import { webAuthnUserVisibleError } from '@/lib/webauthn-client-error'
import { getWebAuthnUnsupportedReason } from '@/lib/webauthn-support'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { startAuthentication } from '@simplewebauthn/browser'

export default function LoginPage() {
  const router = useRouter()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [faceIdMessage, setFaceIdMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [faceIdLoading, setFaceIdLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!login.trim() || !password) {
      setError('Введите логин и пароль')
      return
    }
    setLoading(true)
    const res = await signIn('credentials', {
      login: login.trim().toLowerCase(),
      password,
      redirect: false,
    })
    setLoading(false)
    if (res?.error) {
      setError('Неверный логин или пароль')
    } else {
      router.push('/')
    }
  }

  async function handleFaceId() {
    setFaceIdMessage('')
    setError('')
    const unsupported = getWebAuthnUnsupportedReason()
    if (unsupported) {
      setFaceIdMessage(unsupported)
      return
    }
    setFaceIdLoading(true)
    try {
      const trimmed = login.trim().toLowerCase()
      const optRes = await fetch('/api/webauthn/login/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trimmed ? { login: trimmed } : {}),
      })
      if (optRes.status === 404) {
        setFaceIdMessage('Face ID не настроен, войдите через пароль')
        return
      }
      if (!optRes.ok) {
        setFaceIdMessage('Не удалось начать вход по биометрии')
        return
      }
      const { options, challengeToken } = (await optRes.json()) as {
        options: Parameters<typeof startAuthentication>[0]['optionsJSON']
        challengeToken: string
      }
      const assertion = await startAuthentication({ optionsJSON: options })
      const verifyRes = await fetch('/api/webauthn/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: assertion, challengeToken }),
      })
      if (!verifyRes.ok) {
        setFaceIdMessage('Биометрия не подтверждена. Попробуйте снова или войдите через пароль.')
        return
      }
      const { token } = (await verifyRes.json()) as { token?: string }
      if (!token) {
        setFaceIdMessage('Ошибка сервера')
        return
      }
      const signRes = await signIn('webauthn', { token, redirect: false })
      if (signRes?.error) {
        setFaceIdMessage('Не удалось создать сессию. Войдите через пароль.')
        return
      }
      router.push('/')
    } catch (e) {
      setFaceIdMessage(webAuthnUserVisibleError(e))
    } finally {
      setFaceIdLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border p-8 w-full max-w-md shadow-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Compressor Service</h1>
          <p className="text-gray-500 text-sm mt-1">Войдите в систему</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Логин</label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="current-password"
            />
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
          <button
            type="submit"
            disabled={loading || faceIdLoading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
          <button
            type="button"
            onClick={handleFaceId}
            disabled={faceIdLoading || loading}
            className="w-full border border-gray-200 text-gray-800 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {faceIdLoading ? 'Ожидание биометрии…' : 'Войти через Face ID'}
          </button>
          {faceIdMessage && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm px-3 py-2 rounded-lg">{faceIdMessage}</div>
          )}
        </form>
        <p className="mt-6 text-center text-sm text-gray-500">
          Связаться с тех. поддержкой:{' '}
          <a href="tel:+998901342145" className="text-blue-600 hover:underline whitespace-nowrap">
            +998 90 134 21 45
          </a>
        </p>
      </div>
    </div>
  )
}

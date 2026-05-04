'use client'

import ActSignaturePad from '../tasks/[id]/execute/ActSignaturePad'
import RegisterFaceIdButton from '../users/RegisterFaceIdButton'
import { getWebAuthnUnsupportedReason } from '@/lib/webauthn-support'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

function splitName(full: string): { firstName: string; lastName: string } {
  const p = full.trim().split(/\s+/)
  if (p.length === 0) return { firstName: '', lastName: '' }
  if (p.length === 1) return { firstName: p[0], lastName: '' }
  return { firstName: p[0], lastName: p.slice(1).join(' ') }
}

export default function AccountSettingsClient({
  userId,
  initialName,
  initialSavedActSignature,
}: {
  userId: string
  initialName: string
  initialSavedActSignature: string | null
}) {
  const router = useRouter()
  const [firstName, setFirstName] = useState(() => splitName(initialName).firstName)
  const [lastName, setLastName] = useState(() => splitName(initialName).lastName)
  const [profileMsg, setProfileMsg] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPassword2, setNewPassword2] = useState('')
  const [pwdMsg, setPwdMsg] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)

  const [templateSig, setTemplateSig] = useState<string | null>(initialSavedActSignature)
  const [sigMsg, setSigMsg] = useState('')
  const [webauthnEnvHint, setWebauthnEnvHint] = useState<string | null>(null)

  useEffect(() => {
    setTemplateSig(initialSavedActSignature)
  }, [initialSavedActSignature])

  useEffect(() => {
    setWebauthnEnvHint(getWebAuthnUnsupportedReason())
  }, [])

  async function persistTemplate(dataUrl: string | null) {
    const res = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'savedActSignature', dataUrl }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setSigMsg((data as { error?: string }).error || 'Не удалось сохранить подпись')
      return false
    }
    setSigMsg(dataUrl ? 'Шаблон подписи сохранён' : 'Шаблон удалён')
    router.refresh()
    return true
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileMsg('')
    setProfileLoading(true)
    const res = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'profile', firstName, lastName }),
    })
    const data = await res.json().catch(() => ({}))
    setProfileLoading(false)
    if (!res.ok) {
      setProfileMsg((data as { error?: string }).error || 'Ошибка сохранения')
      return
    }
    setProfileMsg('Сохранено. Имя в меню обновится после следующего входа.')
    router.refresh()
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwdMsg('')
    if (newPassword !== newPassword2) {
      setPwdMsg('Новые пароли не совпадают')
      return
    }
    setPwdLoading(true)
    const res = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'password', currentPassword, newPassword }),
    })
    const data = await res.json().catch(() => ({}))
    setPwdLoading(false)
    if (!res.ok) {
      setPwdMsg((data as { error?: string }).error || 'Ошибка')
      return
    }
    setPwdMsg('Пароль обновлён')
    setCurrentPassword('')
    setNewPassword('')
    setNewPassword2('')
  }

  return (
    <div className="max-w-xl space-y-8">
      <section className="bg-white border rounded-xl p-4 md:p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-1">Имя и фамилия</h2>
        <p className="text-sm text-gray-500 mb-4">Отображаются в системе как ваше ФИО.</p>
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Имя</label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Фамилия</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          {profileMsg && (
            <p className={`text-sm ${profileMsg.startsWith('Сохранено') ? 'text-green-600' : 'text-red-600'}`}>{profileMsg}</p>
          )}
          <button
            type="submit"
            disabled={profileLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {profileLoading ? 'Сохранение…' : 'Сохранить'}
          </button>
        </form>
      </section>

      <section className="bg-white border rounded-xl p-4 md:p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-1">Пароль</h2>
        <p className="text-sm text-gray-500 mb-4">Минимум 8 символов.</p>
        <form onSubmit={savePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Текущий пароль</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Новый пароль</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Повторите новый пароль</label>
            <input
              type="password"
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="new-password"
            />
          </div>
          {pwdMsg && <p className={`text-sm ${pwdMsg === 'Пароль обновлён' ? 'text-green-600' : 'text-red-600'}`}>{pwdMsg}</p>}
          <button
            type="submit"
            disabled={pwdLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {pwdLoading ? 'Сохранение…' : 'Сменить пароль'}
          </button>
        </form>
      </section>

      <section className="bg-white border rounded-xl p-4 md:p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-1">Подпись на акты</h2>
        <p className="text-sm text-gray-500 mb-4">
          Один раз нарисуйте подпись при чистых руках. При закрытии задачи её можно подставить одной кнопкой или подтвердить через Face ID — без рисования в масле.
        </p>
        <ActSignaturePad
          variant="engineer"
          title="Шаблон подписи инженера"
          signedDataUrl={templateSig}
          signedAt={null}
          signerName={null}
          onSigned={async (url) => {
            setSigMsg('')
            const ok = await persistTemplate(url)
            if (ok) setTemplateSig(url)
          }}
          onReset={async () => {
            setSigMsg('')
            const ok = await persistTemplate(null)
            if (ok) setTemplateSig(null)
          }}
        />
        {sigMsg && (
          <p
            className={`text-sm mt-2 ${
              sigMsg.includes('Не ') || sigMsg.includes('Нужна') || sigMsg.includes('Ошибка') ? 'text-red-600' : 'text-green-700'
            }`}
          >
            {sigMsg}
          </p>
        )}
      </section>

      <section className="bg-white border rounded-xl p-4 md:p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-1">Face ID и биометрия</h2>
        <p className="text-sm text-gray-500 mb-4">
          Зарегистрируйте вход по лицу или отпечатку на <strong>этом устройстве</strong>. После этого на экране входа можно нажать «Войти через Face ID» без ввода логина и пароля.
        </p>
        <ul className="text-xs text-gray-600 list-disc pl-5 mb-3 space-y-1">
          <li>На Android чаще всего нужен <strong>Chrome</strong> или <strong>Samsung Internet</strong>, адрес должен быть <strong>https://</strong>.</li>
          <li>Если зашли из Telegram / Instagram / VK — откройте меню <strong>⋯</strong> → «В браузере» / «Открыть в Chrome».</li>
          <li>Включите блокировку экрана с отпечатком или лицом — иначе ключ может не создаться.</li>
        </ul>
        {webauthnEnvHint && (
          <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">{webauthnEnvHint}</p>
        )}
        <RegisterFaceIdButton userId={userId} />
      </section>
    </div>
  )
}

'use client'

import RegisterFaceIdButton from '../users/RegisterFaceIdButton'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

function splitName(full: string): { firstName: string; lastName: string } {
  const p = full.trim().split(/\s+/)
  if (p.length === 0) return { firstName: '', lastName: '' }
  if (p.length === 1) return { firstName: p[0], lastName: '' }
  return { firstName: p[0], lastName: p.slice(1).join(' ') }
}

export default function AccountSettingsClient({
  userId,
  initialName,
}: {
  userId: string
  initialName: string
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
          {profileMsg && <p className={`text-sm ${profileMsg === 'Сохранено' ? 'text-green-600' : 'text-red-600'}`}>{profileMsg}</p>}
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
        <h2 className="text-lg font-semibold mb-1">Face ID и биометрия</h2>
        <p className="text-sm text-gray-500 mb-4">
          Зарегистрируйте вход по лицу или отпечатку на <strong>этом устройстве</strong>. После этого на экране входа можно нажать «Войти через Face ID» без ввода логина и пароля.
        </p>
        <RegisterFaceIdButton userId={userId} />
      </section>
    </div>
  )
}

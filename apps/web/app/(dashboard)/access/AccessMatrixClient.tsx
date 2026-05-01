'use client'

import { useEffect, useMemo, useState } from 'react'

type Role = 'ADMIN' | 'MANAGER' | 'CHIEF_ENGINEER' | 'ENGINEER' | 'CLIENT'

type Permission = {
  id: string
  key: string
  category: 'section' | 'action' | 'field'
  label: string
  description: string | null
}

export default function AccessMatrixClient() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>({})
  const [dirty, setDirty] = useState<Record<string, boolean>>({})
  const [resetRole, setResetRole] = useState<Role>('CHIEF_ENGINEER')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const res = await fetch('/api/access/permissions')
    if (res.ok) {
      const data = await res.json()
      setPermissions(data.permissions)
      setRoles(data.roles)
      if (Array.isArray(data.roles) && data.roles.includes('CHIEF_ENGINEER')) {
        setResetRole('CHIEF_ENGINEER')
      } else if (Array.isArray(data.roles) && data.roles.length > 0) {
        setResetRole(data.roles[0])
      }
      setMatrix(data.matrix)
      setDirty({})
    }
    setLoading(false)
  }

  const grouped = useMemo(() => {
    return {
      section: permissions.filter((p) => p.category === 'section'),
      action: permissions.filter((p) => p.category === 'action'),
      field: permissions.filter((p) => p.category === 'field'),
    }
  }, [permissions])

  function toggle(role: Role, key: string) {
    if (role === 'ADMIN') return
    setMatrix((prev) => ({
      ...prev,
      [role]: { ...(prev[role] || {}), [key]: !(prev[role]?.[key] ?? false) },
    }))
    setDirty((prev) => ({ ...prev, [`${role}::${key}`]: true }))
  }

  async function save() {
    const updates = Object.entries(dirty).map(([entryKey]) => {
      const [role, key] = entryKey.split('::')
      return { role, key, allowed: !!matrix[role]?.[key] }
    })
    if (updates.length === 0) return
    setSaving(true)
    const res = await fetch('/api/access/permissions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    })
    setSaving(false)
    if (res.ok) await load()
  }

  async function resetDefaults() {
    setSaving(true)
    const res = await fetch('/api/access/reset-defaults', { method: 'POST' })
    setSaving(false)
    if (res.ok) await load()
  }

  async function resetDefaultsForRole() {
    if (!confirm(`Сбросить права роли ${resetRole} к значениям по умолчанию?`)) return
    setSaving(true)
    const res = await fetch('/api/access/reset-defaults', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: resetRole }),
    })
    setSaving(false)
    if (res.ok) await load()
  }

  if (loading) {
    return <div className="bg-white border rounded-xl p-6 text-sm text-gray-500">Загрузка матрицы...</div>
  }

  function renderTable(items: Permission[], title: string) {
    return (
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="p-4 border-b bg-gray-50 font-semibold">{title}</div>
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3 font-medium">Право</th>
                {roles.map((role) => (
                  <th key={role} className="text-center p-3 font-medium">
                    {role}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="p-3">
                    <div className="font-medium">{item.label}</div>
                    <div className="text-xs text-gray-400">{item.key}</div>
                  </td>
                  {roles.map((role) => {
                    const checked = role === 'ADMIN' ? true : !!matrix[role]?.[item.key]
                    return (
                      <td key={`${role}-${item.key}`} className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={role === 'ADMIN'}
                          onChange={() => toggle(role, item.key)}
                          className="w-4 h-4 accent-blue-600 disabled:opacity-50"
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 sm:flex-wrap">
        <button
          onClick={save}
          disabled={saving || Object.keys(dirty).length === 0}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Сохранение...' : 'Сохранить изменения'}
        </button>
        <button
          onClick={resetDefaults}
          disabled={saving}
          className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          Сбросить по умолчанию
        </button>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={resetRole}
            onChange={(e) => setResetRole(e.target.value as Role)}
            disabled={saving}
            className="border px-3 py-2 rounded-lg text-sm bg-white disabled:opacity-50"
          >
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <button
            onClick={resetDefaultsForRole}
            disabled={saving || roles.length === 0}
            className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Сбросить только роль
          </button>
        </div>
      </div>

      {renderTable(grouped.section, 'Разделы')}
      {renderTable(grouped.action, 'Действия')}
      {renderTable(grouped.field, 'Видимость полей')}
    </div>
  )
}

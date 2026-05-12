'use client'

import { useEffect, useState } from 'react'

type CityRow = { id: string; name: string }

export function CitySelect(props: {
  value: string
  onChange: (value: string) => void
  required?: boolean
  className?: string
  /** Текущее значение из карточки, если его ещё нет в справочнике */
  legacyValue?: string | null
}) {
  const [cities, setCities] = useState<CityRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/cities')
        if (!res.ok) return
        const data = (await res.json()) as CityRow[]
        if (!cancelled) setCities(data)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const names = new Set(cities.map((c) => c.name))
  const legacy = props.legacyValue?.trim()
  const showLegacy = Boolean(
    legacy && !names.has(legacy) && props.value === legacy,
  )

  return (
    <select
      required={props.required}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      disabled={loading}
      className={props.className}
    >
      <option value="">{loading ? 'Загрузка…' : 'Выберите город'}</option>
      {showLegacy && legacy != null && (
        <option value={legacy}>{legacy} (не в справочнике)</option>
      )}
      {cities.map((c) => (
        <option key={c.id} value={c.name}>
          {c.name}
        </option>
      ))}
    </select>
  )
}

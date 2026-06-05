'use client'

import { useEffect, useState } from 'react'

type EquipmentTypeOption = { id: string; name: string; nameRu: string }

interface Props {
  value: string
  onChange: (val: string) => void
  className?: string
  required?: boolean
  allowEmpty?: boolean
}

export default function EquipmentTypeSelect({
  value,
  onChange,
  className = 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
  required = false,
  allowEmpty = false,
}: Props) {
  const [types, setTypes] = useState<EquipmentTypeOption[]>([])

  useEffect(() => {
    fetch('/api/equipment-types')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setTypes(data)
      })
      .catch(() => setTypes([]))
  }, [])

  const options = types.length > 0 ? types : []
  const hasCurrent =
    !value || options.some((t) => t.name === value)

  return (
    <select
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      {allowEmpty && <option value="">— Выберите тип —</option>}
      {!hasCurrent && value && (
        <option value={value}>{value}</option>
      )}
      {options.map((type) => (
        <option key={type.id} value={type.name}>
          {type.nameRu}
        </option>
      ))}
    </select>
  )
}

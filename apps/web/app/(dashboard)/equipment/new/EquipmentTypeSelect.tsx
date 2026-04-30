'use client'
import { useEffect, useState } from 'react'

interface Props {
  value: string
  onChange: (val: string) => void
}

export default function EquipmentTypeSelect({ value, onChange }: Props) {
  const [types, setTypes] = useState<Array<{ id: string; name: string; nameRu: string }>>([])

  useEffect(() => {
    fetch('/api/equipment-types')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTypes(data)
        }
      })
      .catch(() => {
        setTypes([])
      })
  }, [])

  const fallbackTypes = [
    { id: 'COMPRESSOR', name: 'COMPRESSOR', nameRu: 'Компрессор' },
    { id: 'DRYER', name: 'DRYER', nameRu: 'Осушитель' },
    { id: 'RECEIVER', name: 'RECEIVER', nameRu: 'Ресивер' },
    { id: 'FILTER', name: 'FILTER', nameRu: 'Фильтр' },
    { id: 'NITROGEN_GENERATOR', name: 'NITROGEN_GENERATOR', nameRu: 'Азотный генератор' },
  ]

  const options = types.length > 0 ? types : fallbackTypes

  return (
    <select
      required
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">— Выберите тип —</option>
      {options.map((type) => (
        <option key={type.id} value={type.name}>
          {type.nameRu}
        </option>
      ))}
    </select>
  )
}

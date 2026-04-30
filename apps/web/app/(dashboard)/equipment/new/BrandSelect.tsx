'use client'
import { useState, useEffect, useRef } from 'react'

interface Props {
  value: string
  onChange: (val: string) => void
}

export default function BrandSelect({ value, onChange }: Props) {
  const [brands, setBrands] = useState<any[]>([])
  const [search, setSearch] = useState(value)
  const [showDropdown, setShowDropdown] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newBrand, setNewBrand] = useState('')
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/equipment-brands').then(r => r.json()).then(setBrands)
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = brands.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase())
  )

  function selectBrand(name: string) {
    onChange(name)
    setSearch(name)
    setShowDropdown(false)
  }

  async function addBrand() {
    if (!newBrand.trim()) return
    setLoading(true)
    const res = await fetch('/api/equipment-brands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newBrand.trim() })
    })
    if (res.ok) {
      const created = await res.json()
      setBrands(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      selectBrand(created.name)
      setNewBrand('')
      setShowAdd(false)
    } else {
      const data = await res.json()
      alert(data.error)
    }
    setLoading(false)
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            required
            value={search}
            onChange={e => { setSearch(e.target.value); onChange(''); setShowDropdown(true) }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Начните вводить бренд..."
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {value && (
            <span className="absolute right-2 top-2 text-green-500 text-sm">✓</span>
          )}
        </div>
        <button type="button" onClick={() => setShowAdd(!showAdd)}
          title="Добавить новый бренд"
          className="border rounded-lg px-3 py-2 text-sm hover:bg-gray-50 text-blue-600 font-medium whitespace-nowrap">
          + Новый
        </button>
      </div>

      {showDropdown && (
        <div className="absolute top-10 left-0 right-10 bg-white border rounded-xl shadow-xl z-50 max-h-52 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="p-3 text-sm text-gray-400 text-center">
              Не найдено — нажмите "+ Новый" чтобы добавить
            </div>
          )}
          {filtered.map(brand => (
            <button key={brand.id} type="button"
              onClick={() => selectBrand(brand.name)}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors flex items-center gap-2
                ${value === brand.name ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}>
              {value === brand.name && <span className="text-blue-500">✓</span>}
              {brand.name}
            </button>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
          <input
            value={newBrand}
            onChange={e => setNewBrand(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addBrand())}
            placeholder="Название бренда (Fini, Abac...)"
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            autoFocus
          />
          <button type="button" onClick={addBrand}
            disabled={!newBrand.trim() || loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap">
            {loading ? '...' : '✓ Добавить'}
          </button>
          <button type="button" onClick={() => setShowAdd(false)}
            className="border px-3 py-2 rounded-lg text-sm hover:bg-gray-50">
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

'use client'

import { createPortal } from 'react-dom'
import { useEffect, useMemo, useRef, useState } from 'react'

export type ClientOption = {
  id: string
  name: string
  city?: string | null
  contactPerson?: string | null
  phone?: string | null
  inn?: string | null
}

interface Props {
  value: string
  onChange: (clientId: string) => void
  clients: ClientOption[]
}

function formatSelectedLabel(c: ClientOption): string {
  const tail = [c.city, c.contactPerson].filter(Boolean).join(' · ')
  return tail ? `${c.name} (${tail})` : c.name
}

export default function ClientSelect({ value, onChange, clients }: Props) {
  const [search, setSearch] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [mounted, setMounted] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  const clientsUnique = useMemo(() => {
    const m = new Map<string, ClientOption>()
    for (const c of clients) {
      if (!m.has(c.id)) m.set(c.id, c)
    }
    return [...m.values()]
  }, [clients])

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!value) return
    const c = clientsUnique.find((x) => x.id === value)
    if (c) setSearch(formatSelectedLabel(c))
  }, [value, clientsUnique])

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      const t = e.target as Node
      if (rootRef.current?.contains(t)) return
      if (sheetRef.current?.contains(t)) return
      setShowPicker(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  useEffect(() => {
    if (!showPicker) return
    const mq = window.matchMedia('(max-width: 767px)')
    if (!mq.matches) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [showPicker])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clientsUnique
    return clientsUnique.filter((c) => {
      const name = c.name.toLowerCase()
      const city = c.city?.toLowerCase() ?? ''
      const contact = c.contactPerson?.toLowerCase() ?? ''
      const phone = c.phone ?? ''
      const inn = c.inn ?? ''
      return (
        name.includes(q) ||
        city.includes(q) ||
        contact.includes(q) ||
        phone.includes(q) ||
        inn.includes(q)
      )
    })
  }, [clientsUnique, search])

  function selectClient(c: ClientOption) {
    onChange(c.id)
    setSearch(formatSelectedLabel(c))
    setShowPicker(false)
  }

  const selectedOption = value ? clientsUnique.find((x) => x.id === value) : null

  function renderListItems() {
    if (filtered.length === 0) {
      return (
        <div className="p-4 text-sm text-gray-400 text-center">
          Не найдено — измените запрос или создайте клиента («+ Новый»)
        </div>
      )
    }
    return filtered.map((c) => (
      <button
        key={c.id}
        type="button"
        onClick={() => selectClient(c)}
        className={`w-full text-left px-4 py-3 text-sm hover:bg-blue-50 active:bg-blue-100 transition-colors border-b border-gray-100 last:border-0 touch-manipulation
          ${value === c.id ? 'bg-blue-50 text-blue-900' : 'text-gray-800'}`}
      >
        <div className="flex items-start gap-2">
          {value === c.id ? <span className="text-blue-500 shrink-0 mt-0.5">✓</span> : <span className="w-3 shrink-0" />}
          <span className="min-w-0">
            <span className="font-medium block">{c.name}</span>
            {(c.city || c.contactPerson || c.phone) && (
              <span className="text-xs text-gray-500 block mt-0.5">
                {[c.city, c.contactPerson, c.phone].filter(Boolean).join(' · ')}
              </span>
            )}
          </span>
        </div>
      </button>
    ))
  }

  const mobileSheet =
    mounted &&
    showPicker &&
    createPortal(
      <div
        ref={sheetRef}
        className="fixed inset-0 z-[400] flex flex-col bg-white md:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Выбор клиента"
      >
        <div className="flex items-center gap-2 border-b px-2 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] shrink-0">
          <button
            type="button"
            onClick={() => setShowPicker(false)}
            className="text-blue-600 text-sm font-medium px-3 py-2 touch-manipulation"
          >
            Закрыть
          </button>
          <span className="font-semibold text-base flex-1 text-center pr-16">Выберите клиента</span>
        </div>
        <div className="px-3 py-3 border-b shrink-0">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              onChange('')
            }}
            placeholder="Поиск: название, город, контакт, телефон, ИНН..."
            className="w-full border rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoComplete="off"
            autoFocus
            enterKeyHint="search"
          />
        </div>
        <div className="flex-1 overflow-y-auto overscroll-y-contain min-h-0">{renderListItems()}</div>
        <div className="border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shrink-0 bg-gray-50">
          <a
            href="/clients/new"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center border rounded-lg py-3 text-sm font-medium text-blue-600 bg-white hover:bg-blue-50"
          >
            + Новый клиент
          </a>
        </div>
      </div>,
      document.body
    )

  return (
    <div ref={rootRef} className="relative">
      <div className="flex gap-2">
        {/* Мобильный: кнопка открывает полноэкранный поиск + список */}
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="md:hidden relative flex-1 border rounded-lg px-3 py-2.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between gap-2 min-h-[44px]"
        >
          <span className={selectedOption ? 'text-gray-900' : 'text-gray-400'}>
            {selectedOption ? formatSelectedLabel(selectedOption) : 'Нажмите, чтобы найти клиента…'}
          </span>
          <span className="text-gray-400 text-xs shrink-0">▼</span>
          {value ? <span className="absolute right-8 top-2.5 text-green-500 text-sm pointer-events-none">✓</span> : null}
        </button>

        {/* Десктоп: ввод + выпадающий список */}
        <div className="hidden md:block relative flex-1">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              onChange('')
              setShowPicker(true)
            }}
            onFocus={() => setShowPicker(true)}
            placeholder="Начните вводить название, город, контакт, телефон, ИНН..."
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
            autoComplete="off"
          />
          {value ? (
            <span className="absolute right-2 top-2 text-green-500 text-sm pointer-events-none">✓</span>
          ) : null}
          {showPicker && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-xl z-[100] max-h-52 overflow-y-auto">
              {renderListItems()}
            </div>
          )}
        </div>

        <a
          href="/clients/new"
          target="_blank"
          rel="noopener noreferrer"
          title="Открыть форму нового клиента"
          className="border rounded-lg px-3 py-2 text-sm hover:bg-gray-50 text-blue-600 font-medium whitespace-nowrap self-start min-h-[44px] inline-flex items-center justify-center"
        >
          + Новый
        </a>
      </div>
      {mobileSheet}
    </div>
  )
}

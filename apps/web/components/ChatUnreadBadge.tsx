'use client'

import { useCallback, useEffect, useState } from 'react'

export default function ChatUnreadBadge() {
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    const res = await fetch('/api/chat/unread-total')
    if (res.ok) {
      const d = (await res.json()) as { total?: number }
      setTotal(typeof d.total === 'number' ? d.total : 0)
    }
  }, [])

  useEffect(() => {
    void load()
    const id = setInterval(load, 8000)
    const onRead = () => void load()
    window.addEventListener('csp-chat-mark-read', onRead)
    return () => {
      clearInterval(id)
      window.removeEventListener('csp-chat-mark-read', onRead)
    }
  }, [load])

  if (total <= 0) return null

  const label = total > 99 ? '+99' : `+${total}`

  return (
    <span className="ml-auto min-w-[1.35rem] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none flex items-center justify-center shrink-0">
      {label}
    </span>
  )
}

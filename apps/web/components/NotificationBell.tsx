'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Notification {
  id: string
  title: string
  message: string
  type: string
  isRead: boolean
  link?: string | null
  createdAt: string
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'только что'
  if (mins < 60) return `${mins} мин назад`
  if (hours < 24) return `${hours} ч назад`
  return `${days} дн назад`
}

const typeStyles: Record<string, { icon: string; color: string }> = {
  CHAT: { icon: '💬', color: 'text-indigo-600' },
  TASK: { icon: '📋', color: 'text-blue-600' },
  URGENT: { icon: '🔴', color: 'text-red-600' },
  SUCCESS: { icon: '✅', color: 'text-green-600' },
  WARNING: { icon: '⚠️', color: 'text-orange-600' },
  INFO: { icon: 'ℹ️', color: 'text-gray-600' },
}

export default function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])

  const unread = notifications.filter((n) => !n.isRead).length

  const loadNotifications = useCallback(async () => {
    const res = await fetch('/api/notifications')
    if (res.ok) {
      const data = await res.json()
      setNotifications(data)
    }
  }, [])

  useEffect(() => {
    loadNotifications()
    const interval = setInterval(loadNotifications, 12000)
    return () => clearInterval(interval)
  }, [loadNotifications])

  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ readAll: true }),
    })
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
  }

  async function handleClick(notification: Notification) {
    if (!notification.isRead) {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notification.id }),
      })
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
      )
    }
    if (notification.link) {
      setOpen(false)
      router.push(notification.link)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default bg-transparent"
            aria-label="Закрыть"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-8 top-0 w-80 bg-white border rounded-xl shadow-2xl z-20 overflow-hidden">
            <div className="p-3 border-b bg-gray-50 flex justify-between items-center">
              <span className="font-semibold text-sm">Уведомления</span>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Прочитать все
                  </button>
                )}
                <span className="text-xs text-gray-400">{unread} новых</span>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 && (
                <div className="p-8 text-center text-gray-400 text-sm">
                  <div className="text-3xl mb-2">🔔</div>
                  Уведомлений нет
                </div>
              )}
              {notifications.map((n) => {
                const style = typeStyles[n.type] || typeStyles.INFO
                return (
                  <div
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleClick(n)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleClick(n)
                      }
                    }}
                    className={`flex gap-3 p-3 border-b last:border-0 cursor-pointer hover:bg-gray-50 transition-colors ${!n.isRead ? 'bg-blue-50/50' : ''}`}
                  >
                    <div className="flex-shrink-0 text-lg">{style.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-sm font-medium ${!n.isRead ? 'text-gray-900' : 'text-gray-600'}`}
                      >
                        {n.title}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 truncate">{n.message}</div>
                      <div className="text-xs text-gray-400 mt-1">{timeAgo(n.createdAt)}</div>
                    </div>
                    {!n.isRead && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

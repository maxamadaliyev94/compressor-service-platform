'use client'
import { useState, useEffect } from 'react'

const actionLabels: Record<string, { label: string; icon: string; color: string }> = {
  CREATE:        { label: 'Добавлено',          icon: '✚',  color: 'bg-green-100 text-green-700' },
  UPDATE_HOURS:  { label: 'Моточасы',           icon: '⏱',  color: 'bg-blue-100 text-blue-700' },
  UPDATE:        { label: 'Изменено',            icon: '✏️', color: 'bg-yellow-100 text-yellow-700' },
  COMMENT:       { label: 'Комментарий',         icon: '💬', color: 'bg-purple-100 text-purple-700' },
  DELETE:        { label: 'Удалено',             icon: '✕',  color: 'bg-red-100 text-red-700' },
}

const roleLabels: Record<string, string> = {
  ADMIN: 'Админ', MANAGER: 'Менеджер',
  CHIEF_ENGINEER: 'Гл. инженер', ENGINEER: 'Инженер', CLIENT: 'Клиент',
}

function formatDate(date: string) {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'только что'
  if (mins < 60) return `${mins} мин назад`
  if (hours < 24) return `${hours} ч назад`
  if (days < 7) return `${days} дн назад`
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatFullDate(date: string) {
  return new Date(date).toLocaleString('ru-RU', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export default function EquipmentHistory({ equipmentId }: { equipmentId: string }) {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadHistory()
  }, [equipmentId])

  async function loadHistory() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/equipment/${equipmentId}/history`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || 'Не удалось загрузить историю')
        setLogs([])
        return
      }
      const data = await res.json()
      setLogs(Array.isArray(data) ? data : [])
    } catch {
      setError('Не удалось загрузить историю')
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  async function addComment() {
    if (!comment.trim()) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/equipment/${equipmentId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: comment.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || 'Не удалось сохранить комментарий')
        return
      }
      const newLog = await res.json()
      setLogs(prev => [newLog, ...prev])
      setComment('')
    } catch {
      setError('Не удалось сохранить комментарий')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-white border rounded-xl overflow-hidden md:sticky md:top-4">
      <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
        <h2 className="font-semibold text-sm">📋 История изменений</h2>
        <span className="text-xs text-gray-400">{logs.length}</span>
      </div>

      <div className="p-3 border-b bg-purple-50">
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) addComment() }}
          placeholder="Добавить комментарий... (Ctrl+Enter)"
          rows={2}
          className="w-full border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white resize-none"
        />
        <button onClick={addComment} disabled={!comment.trim() || sending}
          className="mt-2 w-full bg-purple-600 text-white py-1.5 rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50">
          {sending ? 'Отправка...' : '💬 Добавить комментарий'}
        </button>
        {error && (
          <p className="mt-2 text-xs text-red-600">{error}</p>
        )}
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: '600px' }}>
        {loading && (
          <div className="p-6 text-center text-gray-400 text-xs">Загрузка...</div>
        )}
        {!loading && logs.length === 0 && (
          <div className="p-6 text-center text-gray-400 text-xs">
            <div className="text-2xl mb-2">📋</div>
            История пуста
          </div>
        )}
        {logs.map((log) => {
          const action = actionLabels[log.action] || { label: log.action, icon: 'ℹ️', color: 'bg-gray-100 text-gray-700' }
          const isHours = log.action === 'UPDATE_HOURS'
          const oldH = log.oldValue ? parseInt(log.oldValue) : null
          const newH = log.newValue ? parseInt(log.newValue) : null
          const diff = (oldH !== null && newH !== null) ? newH - oldH : null

          return (
            <div key={log.id} className="flex gap-3 p-3 border-b last:border-0 hover:bg-gray-50">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 font-bold ${action.color}`}>
                {action.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-medium text-gray-700">{action.label}</span>
                  <span className="text-xs text-gray-400" title={formatFullDate(log.createdAt)}>
                    {formatDate(log.createdAt)}
                  </span>
                </div>

                {isHours && oldH !== null && newH !== null && (
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs text-gray-400 line-through">{oldH}</span>
                    <span className="text-xs text-gray-400">→</span>
                    <span className="text-xs font-bold text-gray-800">{newH} м/ч</span>
                    {diff !== null && (
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${diff >= 0 ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                        {diff >= 0 ? `+${diff}` : diff}
                      </span>
                    )}
                  </div>
                )}

                {log.comment && (
                  <div className={`text-xs rounded-lg px-2 py-1.5 mt-1 ${
                    log.action === 'COMMENT'
                      ? 'bg-purple-50 text-purple-800 border border-purple-100'
                      : 'bg-gray-50 text-gray-600 italic'
                  }`}>
                    {log.comment}
                  </div>
                )}

                <div className="flex items-center gap-1 mt-1">
                  <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                    {log.user?.name?.charAt(0) || '?'}
                  </div>
                  <span className="text-xs text-gray-500">{log.user?.name || 'Система'}</span>
                  {log.user?.role && (
                    <span className="text-xs text-gray-400">· {roleLabels[log.user.role]}</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

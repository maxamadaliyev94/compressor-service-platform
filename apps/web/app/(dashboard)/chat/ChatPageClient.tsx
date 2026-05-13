'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type LastMsg = {
  body: string
  createdAt: string
  authorName: string
  isSystem: boolean
} | null

type StaffUser = { id: string; name: string; role: string }

type RoomsPayload = {
  general: { id: string; type: string; title: string; lastMessage: LastMsg }
  direct: {
    id: string
    type: string
    title: string
    peer: StaffUser | null
    lastMessage: LastMsg
  }[]
  tasks: {
    id: string
    type: string
    taskId: string | null
    title: string
    lastMessage: LastMsg
  }[]
  staffUsers: StaffUser[]
  currentUserId?: string
  currentUserRole?: string
}

type ChatMessage = {
  id: string
  body: string
  isSystem: boolean
  deletedAt: string | null
  editedAt: string | null
  createdAt: string
  author: { id: string; name: string; role: string }
}

function dispatchChatRead() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('csp-chat-mark-read'))
  }
}

export default function ChatPageClient({ initialRoomId }: { initialRoomId: string | null }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [rooms, setRooms] = useState<RoomsPayload | null>(null)
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(initialRoomId)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [loadingRooms, setLoadingRooms] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [peerPick, setPeerPick] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadRooms = useCallback(async () => {
    const res = await fetch('/api/chat/rooms')
    if (!res.ok) return
    const data = (await res.json()) as RoomsPayload
    setRooms(data)
    if (data.currentUserId) setCurrentUserId(data.currentUserId)
    setLoadingRooms(false)
  }, [])

  const markRoomRead = useCallback(async (roomId: string) => {
    await fetch(`/api/chat/rooms/${roomId}/read`, { method: 'POST' })
    dispatchChatRead()
  }, [])

  const loadMessages = useCallback(
    async (roomId: string) => {
      setLoadingMessages(true)
      const res = await fetch(`/api/chat/rooms/${roomId}/messages`)
      if (res.ok) {
        const data = (await res.json()) as { messages: ChatMessage[]; currentUserId?: string }
        setMessages(data.messages)
        if (data.currentUserId) setCurrentUserId(data.currentUserId)
        await markRoomRead(roomId)
      }
      setLoadingMessages(false)
    },
    [markRoomRead]
  )

  useEffect(() => {
    void loadRooms()
    const id = setInterval(loadRooms, 8000)
    return () => clearInterval(id)
  }, [loadRooms])

  useEffect(() => {
    if (!selectedRoomId) return
    void loadMessages(selectedRoomId)
    const id = setInterval(() => loadMessages(selectedRoomId), 4000)
    return () => clearInterval(id)
  }, [selectedRoomId, loadMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function selectRoom(roomId: string) {
    setSelectedRoomId(roomId)
    setEditingId(null)
    router.replace(`/chat?room=${encodeURIComponent(roomId)}`, { scroll: false })
  }

  useEffect(() => {
    const fromUrl = searchParams.get('room')
    if (fromUrl && fromUrl !== selectedRoomId) {
      setSelectedRoomId(fromUrl)
    }
  }, [searchParams, selectedRoomId])

  async function openDm() {
    if (!peerPick) return
    const res = await fetch('/api/chat/dm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ peerUserId: peerPick }),
    })
    if (!res.ok) return
    const data = (await res.json()) as { roomId: string }
    setPeerPick('')
    await loadRooms()
    selectRoom(data.roomId)
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedRoomId || !draft.trim() || sending) return
    setSending(true)
    try {
      const res = await fetch(`/api/chat/rooms/${selectedRoomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: draft.trim() }),
      })
      if (res.ok) {
        setDraft('')
        await loadMessages(selectedRoomId)
        await loadRooms()
      }
    } finally {
      setSending(false)
    }
  }

  async function clearHistory() {
    if (!selectedRoomId) return
    if (!confirm('Удалить все сообщения в этом чате для всех участников?')) return
    const res = await fetch(`/api/chat/rooms/${selectedRoomId}/clear`, { method: 'POST' })
    if (res.ok) {
      await loadMessages(selectedRoomId)
      await loadRooms()
      dispatchChatRead()
    } else {
      const d = await res.json().catch(() => ({}))
      alert((d as { error?: string }).error || 'Не удалось очистить')
    }
  }

  async function hideChat() {
    if (!selectedRoomId) return
    if (!confirm('Скрыть чат из списка? История сохранится — при новом сообщении чат появится снова.')) return
    const res = await fetch(`/api/chat/rooms/${selectedRoomId}/hide`, { method: 'POST' })
    if (res.ok) {
      setSelectedRoomId(null)
      router.replace('/chat', { scroll: false })
      await loadRooms()
      dispatchChatRead()
    }
  }

  function startEdit(m: ChatMessage) {
    setEditingId(m.id)
    setEditDraft(m.body)
  }

  async function saveEdit() {
    if (!selectedRoomId || !editingId || !editDraft.trim()) return
    const res = await fetch(`/api/chat/rooms/${selectedRoomId}/messages/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: editDraft.trim() }),
    })
    if (res.ok) {
      setEditingId(null)
      await loadMessages(selectedRoomId)
      await loadRooms()
    }
  }

  async function deleteMessage(messageId: string) {
    if (!selectedRoomId || !confirm('Удалить сообщение?')) return
    const res = await fetch(`/api/chat/rooms/${selectedRoomId}/messages/${messageId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      await loadMessages(selectedRoomId)
      await loadRooms()
    }
  }

  function formatTime(iso: string) {
    try {
      return new Date(iso).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  const general = rooms?.general
  const role = rooms?.currentUserRole ?? ''
  const roomKind: 'GENERAL' | 'DIRECT' | 'TASK' | null =
    general && selectedRoomId === general.id
      ? 'GENERAL'
      : rooms?.direct.some((d) => d.id === selectedRoomId)
        ? 'DIRECT'
        : rooms?.tasks.some((t) => t.id === selectedRoomId)
          ? 'TASK'
          : null

  const canClearGeneral = role === 'ADMIN'
  const showClear =
    selectedRoomId &&
    (roomKind === 'DIRECT' || roomKind === 'TASK' || (roomKind === 'GENERAL' && canClearGeneral))
  const showHide = selectedRoomId && (roomKind === 'DIRECT' || roomKind === 'TASK')

  return (
    <div className="flex flex-col md:flex-row gap-4 min-h-[calc(100vh-8rem)]">
      <aside className="w-full md:w-80 flex-shrink-0 border rounded-xl bg-white overflow-hidden flex flex-col max-h-[40vh] md:max-h-none">
        <div className="p-3 border-b bg-gray-50 space-y-2">
          <div className="text-xs font-semibold text-gray-500 uppercase">Личное сообщение</div>
          <div className="flex gap-2">
            <select
              value={peerPick}
              onChange={(e) => setPeerPick(e.target.value)}
              className="flex-1 min-w-0 border rounded-lg px-2 py-2 text-sm"
            >
              <option value="">Выберите сотрудника</option>
              {(rooms?.staffUsers ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!peerPick}
              onClick={() => void openDm()}
              className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-40"
            >
              Открыть
            </button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-2 space-y-1 text-sm">
          {loadingRooms && <div className="text-gray-400 p-2">Загрузка…</div>}
          {general && (
            <button
              type="button"
              onClick={() => selectRoom(general.id)}
              className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                selectedRoomId === general.id ? 'bg-blue-50 border-blue-200' : 'border-transparent hover:bg-gray-50'
              }`}
            >
              <div className="font-medium text-gray-900">💬 {general.title}</div>
              {general.lastMessage && (
                <div className="text-xs text-gray-500 truncate mt-0.5">{general.lastMessage.body}</div>
              )}
            </button>
          )}
          <div className="text-xs font-semibold text-gray-500 uppercase px-2 pt-3 pb-1">Личные</div>
          {(rooms?.direct ?? []).length === 0 && (
            <div className="text-xs text-gray-400 px-2">Нет переписок</div>
          )}
          {(rooms?.direct ?? []).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => selectRoom(r.id)}
              className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                selectedRoomId === r.id ? 'bg-blue-50 border-blue-200' : 'border-transparent hover:bg-gray-50'
              }`}
            >
              <div className="font-medium text-gray-900 truncate">👤 {r.title}</div>
              {r.lastMessage && (
                <div className="text-xs text-gray-500 truncate mt-0.5">{r.lastMessage.body}</div>
              )}
            </button>
          ))}
          <div className="text-xs font-semibold text-gray-500 uppercase px-2 pt-3 pb-1">По задачам</div>
          {(rooms?.tasks ?? []).length === 0 && (
            <div className="text-xs text-gray-400 px-2">Откройте чат из карточки задачи</div>
          )}
          {(rooms?.tasks ?? []).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => selectRoom(r.id)}
              className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                selectedRoomId === r.id ? 'bg-blue-50 border-blue-200' : 'border-transparent hover:bg-gray-50'
              }`}
            >
              <div className="font-medium text-gray-900 truncate">📋 {r.title}</div>
              {r.lastMessage && (
                <div className="text-xs text-gray-500 truncate mt-0.5">{r.lastMessage.body}</div>
              )}
            </button>
          ))}
        </div>
      </aside>

      <section className="flex-1 flex flex-col border rounded-xl bg-white min-h-[320px] md:min-h-[480px]">
        {!selectedRoomId ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm p-8">
            Выберите чат слева или начните личную переписку
          </div>
        ) : (
          <>
            <div className="border-b px-4 py-3 bg-gray-50 flex flex-wrap items-center gap-2 justify-between">
              <div className="text-sm font-medium text-gray-800 min-w-0">
                {general && selectedRoomId === general.id && general.title}
                {rooms?.direct.find((d) => d.id === selectedRoomId) && (
                  <>👤 {rooms.direct.find((d) => d.id === selectedRoomId)?.title}</>
                )}
                {rooms?.tasks.find((t) => t.id === selectedRoomId) && (
                  <>📋 {rooms.tasks.find((t) => t.id === selectedRoomId)?.title}</>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {showClear && (
                  <button
                    type="button"
                    onClick={() => void clearHistory()}
                    className="text-xs px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50"
                  >
                    Очистить историю
                  </button>
                )}
                {showHide && (
                  <button
                    type="button"
                    onClick={() => void hideChat()}
                    className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
                  >
                    Скрыть чат
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
              {loadingMessages && messages.length === 0 ? (
                <div className="text-gray-400 text-sm">Загрузка сообщений…</div>
              ) : (
                messages.map((m) => {
                  const isOwnAuthor =
                    Boolean(currentUserId && m.author.id === currentUserId) && !m.isSystem
                  const isDeleted = Boolean(m.deletedAt)
                  const showActions = isOwnAuthor && !isDeleted

                  return (
                    <div
                      key={m.id}
                      className={`flex ${m.isSystem ? 'justify-center' : isOwnAuthor ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`relative group max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                          m.isSystem
                            ? 'mx-auto bg-amber-50 border border-amber-100 text-amber-900 text-center max-w-full'
                            : isOwnAuthor
                              ? 'bg-blue-50 border border-blue-100'
                              : 'bg-white border shadow-sm'
                        }`}
                      >
                        {showActions && (
                          <div className="absolute -top-0.5 right-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <button
                              type="button"
                              onClick={() => startEdit(m)}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-white border shadow text-gray-700 hover:bg-gray-50"
                            >
                              Изменить
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteMessage(m.id)}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-white border shadow text-red-600 hover:bg-red-50"
                            >
                              Удалить
                            </button>
                          </div>
                        )}
                        {!m.isSystem && (
                          <div className="text-xs text-gray-500 mb-1 pr-12">
                            <span className="font-medium text-gray-700">{m.author.name}</span>
                            <span className="ml-2">{formatTime(m.createdAt)}</span>
                          </div>
                        )}
                        {editingId === m.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              rows={3}
                              className="w-full border rounded px-2 py-1 text-sm"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => void saveEdit()}
                                className="text-xs px-2 py-1 bg-blue-600 text-white rounded"
                              >
                                Сохранить
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="text-xs px-2 py-1 border rounded"
                              >
                                Отмена
                              </button>
                            </div>
                          </div>
                        ) : isDeleted ? (
                          <div className="italic text-gray-400">Сообщение удалено</div>
                        ) : (
                          <>
                            <div className="whitespace-pre-wrap break-words">{m.body}</div>
                            {m.editedAt && (
                              <div className="text-[10px] text-gray-400 mt-1">изменено</div>
                            )}
                          </>
                        )}
                        {m.isSystem && (
                          <div className="text-[10px] text-amber-700/80 mt-1">{formatTime(m.createdAt)}</div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={bottomRef} />
            </div>
            <form onSubmit={sendMessage} className="border-t p-3 flex gap-2 bg-white">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Сообщение…"
                className="flex-1 border rounded-lg px-3 py-2 text-sm"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-40"
              >
                Отправить
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  )
}

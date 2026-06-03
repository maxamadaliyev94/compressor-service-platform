'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MoreVertical, X } from 'lucide-react'

type LastMsg = {
  body: string
  createdAt: string
  authorName: string
  isSystem: boolean
} | null

type StaffUser = { id: string; name: string; role: string }

type RoomsPayload = {
  general: { id: string; type: string; title: string; unreadCount?: number; lastMessage: LastMsg }
  comments: { id: string; type: string; title: string; unreadCount?: number; lastMessage: LastMsg }
  direct: {
    id: string
    type: string
    title: string
    unreadCount?: number
    peer: StaffUser | null
    lastMessage: LastMsg
  }[]
  tasks: {
    id: string
    type: string
    taskId: string | null
    title: string
    unreadCount?: number
    lastMessage: LastMsg
  }[]
  staffUsers: StaffUser[]
  currentUserId?: string
  currentUserRole?: string
}

type EngineerInternalCommentMetadata = {
  kind: 'ENGINEER_INTERNAL'
  taskId: string
  taskNumber: number
  branchName: string
  equipmentBrand: string
  equipmentModel: string
  serialNumber: string
  commentText: string
  acknowledged?: {
    userId: string
    userName: string
    at: string
  }
}

type ChatMessage = {
  id: string
  body: string
  isSystem: boolean
  metadata?: EngineerInternalCommentMetadata | null
  deletedAt: string | null
  editedAt: string | null
  createdAt: string
  author: { id: string; name: string; role: string; avatarUrl?: string | null }
}

function isEngineerInternalComment(
  metadata: EngineerInternalCommentMetadata | null | undefined
): metadata is EngineerInternalCommentMetadata {
  return metadata?.kind === 'ENGINEER_INTERNAL'
}

function dispatchChatRead() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('csp-chat-mark-read'))
  }
}

function RoomUnreadBadge({ count }: { count?: number }) {
  if (!count || count <= 0) return null
  const label = count > 99 ? '+99' : `+${count}`
  return (
    <span className="shrink-0 min-w-[1.35rem] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none flex items-center justify-center">
      {label}
    </span>
  )
}

function SenderAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null | undefined }) {
  const initial = name.charAt(0).toUpperCase()
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className="w-9 h-9 rounded-full object-cover border border-gray-200 flex-shrink-0 bg-white"
      />
    )
  }
  return (
    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 flex items-center justify-center text-sm font-semibold flex-shrink-0 border border-gray-200">
      {initial}
    </div>
  )
}

function DirectChatRowMenu({
  isOpen,
  onOpenChange,
  onClearHistory,
  onHideChat,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onClearHistory: () => void
  onHideChat: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOpenChange(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [isOpen, onOpenChange])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title="Действия"
        className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onOpenChange(!isOpen)
        }}
      >
        <MoreVertical className="w-4 h-4" strokeWidth={2} />
      </button>
      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-[11rem] rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-50"
            onClick={(e) => {
              e.stopPropagation()
              onClearHistory()
              onOpenChange(false)
            }}
          >
            Очистить историю
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full px-3 py-2 text-left text-red-700 hover:bg-red-50"
            onClick={(e) => {
              e.stopPropagation()
              onHideChat()
              onOpenChange(false)
            }}
          >
            Удалить чат
          </button>
        </div>
      )}
    </div>
  )
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

const SCROLL_BOTTOM_THRESHOLD_PX = 80

function isScrollNearBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_BOTTOM_THRESHOLD_PX
}

function messageMatchesSearch(m: ChatMessage, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (m.deletedAt) return false
  return m.body.toLowerCase().includes(q)
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
  const [directMenuRoomId, setDirectMenuRoomId] = useState<string | null>(null)
  const [messageSearch, setMessageSearch] = useState('')
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null)
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const shouldStickToBottomRef = useRef(true)
  const prevLastMessageIdRef = useRef<string | null>(null)

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
    shouldStickToBottomRef.current = true
    prevLastMessageIdRef.current = null
    setMessageSearch('')
  }, [selectedRoomId])

  useEffect(() => {
    if (loadingMessages || messages.length === 0) return
    if (messageSearch.trim()) return

    const lastId = messages[messages.length - 1]?.id ?? null
    const isFirstLoad = prevLastMessageIdRef.current === null
    const hasNewMessage = lastId !== prevLastMessageIdRef.current && !isFirstLoad

    if (!shouldStickToBottomRef.current && !isFirstLoad) return
    if (!isFirstLoad && !hasNewMessage) return

    prevLastMessageIdRef.current = lastId

    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: isFirstLoad || !hasNewMessage ? 'auto' : 'smooth' })
    })
  }, [messages, loadingMessages, messageSearch])

  function handleMessagesScroll() {
    const el = messagesScrollRef.current
    if (!el) return
    shouldStickToBottomRef.current = isScrollNearBottom(el)
  }

  function selectRoom(roomId: string) {
    setSelectedRoomId(roomId)
    setEditingId(null)
    setMessageSearch('')
    shouldStickToBottomRef.current = true
    prevLastMessageIdRef.current = null
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

  async function clearHistoryForRoom(roomId: string) {
    if (!confirm('Удалить все сообщения в этом чате для всех участников?')) return
    const res = await fetch(`/api/chat/rooms/${roomId}/clear`, { method: 'POST' })
    if (res.ok) {
      if (selectedRoomId === roomId) await loadMessages(roomId)
      await loadRooms()
      dispatchChatRead()
    } else {
      const d = await res.json().catch(() => ({}))
      alert((d as { error?: string }).error || 'Не удалось очистить')
    }
  }

  async function hideChatForRoom(roomId: string) {
    if (
      !confirm(
        'Удалить этот чат из списка? История сохранится — при новом сообщении чат появится снова.'
      )
    )
      return
    const res = await fetch(`/api/chat/rooms/${roomId}/hide`, { method: 'POST' })
    if (res.ok) {
      setDirectMenuRoomId(null)
      if (selectedRoomId === roomId) {
        setSelectedRoomId(null)
        router.replace('/chat', { scroll: false })
      }
      await loadRooms()
      dispatchChatRead()
    }
  }

  async function clearHistory() {
    if (!selectedRoomId) return
    await clearHistoryForRoom(selectedRoomId)
  }

  async function hideChat() {
    if (!selectedRoomId) return
    await hideChatForRoom(selectedRoomId)
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

  async function acknowledgeComment(messageId: string) {
    if (!selectedRoomId || acknowledgingId) return
    setAcknowledgingId(messageId)
    try {
      const res = await fetch(
        `/api/chat/rooms/${selectedRoomId}/messages/${messageId}/ack`,
        { method: 'POST' }
      )
      if (res.ok) {
        await loadMessages(selectedRoomId)
      } else {
        const d = await res.json().catch(() => ({}))
        alert((d as { error?: string }).error || 'Не удалось принять комментарий')
      }
    } finally {
      setAcknowledgingId(null)
    }
  }

  const filteredMessages = useMemo(() => {
    const q = messageSearch.trim()
    if (!q) return messages
    return messages.filter((m) => messageMatchesSearch(m, q))
  }, [messages, messageSearch])

  const general = rooms?.general
  const comments = rooms?.comments
  const role = rooms?.currentUserRole ?? ''
  const roomKind: 'GENERAL' | 'COMMENTS' | 'DIRECT' | 'TASK' | null =
    general && selectedRoomId === general.id
      ? 'GENERAL'
      : comments && selectedRoomId === comments.id
        ? 'COMMENTS'
        : rooms?.direct.some((d) => d.id === selectedRoomId)
          ? 'DIRECT'
          : rooms?.tasks.some((t) => t.id === selectedRoomId)
            ? 'TASK'
            : null

  const canClearGeneral = role === 'ADMIN'
  const canAckComments = role === 'ADMIN' || role === 'MANAGER' || role === 'CHIEF_ENGINEER'
  const showClear =
    selectedRoomId &&
    (roomKind === 'DIRECT' ||
      roomKind === 'TASK' ||
      ((roomKind === 'GENERAL' || roomKind === 'COMMENTS') && canClearGeneral))
  const showHide = selectedRoomId && (roomKind === 'DIRECT' || roomKind === 'TASK')
  const isGeneralRoom = roomKind === 'GENERAL'
  const isCommentsRoom = roomKind === 'COMMENTS'

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
              <div className="flex items-center gap-2 w-full min-w-0">
                <span className="font-medium text-gray-900 truncate flex-1 min-w-0 text-left">
                  💬 {general.title}
                </span>
                <RoomUnreadBadge count={general.unreadCount} />
              </div>
              {general.lastMessage && (
                <div className="text-xs text-gray-500 truncate mt-0.5">{general.lastMessage.body}</div>
              )}
            </button>
          )}
          {comments && (
            <button
              type="button"
              onClick={() => selectRoom(comments.id)}
              className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                selectedRoomId === comments.id ? 'bg-blue-50 border-blue-200' : 'border-transparent hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2 w-full min-w-0">
                <span className="font-medium text-gray-900 truncate flex-1 min-w-0 text-left">
                  📝 {comments.title}
                </span>
                <RoomUnreadBadge count={comments.unreadCount} />
              </div>
              {comments.lastMessage && (
                <div className="text-xs text-gray-500 truncate mt-0.5">{comments.lastMessage.body}</div>
              )}
            </button>
          )}
          <div className="text-xs font-semibold text-gray-500 uppercase px-2 pt-3 pb-1">Личные</div>
          {(rooms?.direct ?? []).length === 0 && (
            <div className="text-xs text-gray-400 px-2">Нет переписок</div>
          )}
          {(rooms?.direct ?? []).map((r) => (
            <div
              key={r.id}
              className={`group flex items-stretch rounded-lg border transition-colors ${
                selectedRoomId === r.id ? 'bg-blue-50 border-blue-200' : 'border-transparent hover:bg-gray-50'
              }`}
            >
              <button
                type="button"
                onClick={() => selectRoom(r.id)}
                className="flex-1 min-w-0 text-left px-3 py-2 rounded-l-lg"
              >
                <div className="flex items-center gap-2 w-full min-w-0">
                  <span className="font-medium text-gray-900 truncate flex-1 min-w-0 text-left">
                    👤 {r.title}
                  </span>
                  <RoomUnreadBadge count={r.unreadCount} />
                </div>
                {r.lastMessage && (
                  <div className="text-xs text-gray-500 truncate mt-0.5">{r.lastMessage.body}</div>
                )}
              </button>
              <div
                className={`flex shrink-0 items-start pt-1.5 pr-1 transition-opacity ${
                  directMenuRoomId === r.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
              >
                <DirectChatRowMenu
                  isOpen={directMenuRoomId === r.id}
                  onOpenChange={(open) => setDirectMenuRoomId(open ? r.id : null)}
                  onClearHistory={() => void clearHistoryForRoom(r.id)}
                  onHideChat={() => void hideChatForRoom(r.id)}
                />
              </div>
            </div>
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
              <div className="flex items-center gap-2 w-full min-w-0">
                <span className="font-medium text-gray-900 truncate flex-1 min-w-0 text-left">
                  📋 {r.title}
                </span>
                <RoomUnreadBadge count={r.unreadCount} />
              </div>
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
                {comments && selectedRoomId === comments.id && comments.title}
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
            <div className="border-b px-4 py-2 bg-white">
              <div className="relative">
                <input
                  type="search"
                  value={messageSearch}
                  onChange={(e) => setMessageSearch(e.target.value)}
                  placeholder="Поиск по сообщениям…"
                  className="w-full border rounded-lg pl-3 pr-9 py-2 text-sm"
                />
                {messageSearch && (
                  <button
                    type="button"
                    onClick={() => setMessageSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    aria-label="Очистить поиск"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div
              ref={messagesScrollRef}
              onScroll={handleMessagesScroll}
              className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50"
            >
              {loadingMessages && messages.length === 0 ? (
                <div className="text-gray-400 text-sm">Загрузка сообщений…</div>
              ) : messageSearch.trim() && filteredMessages.length === 0 ? (
                <div className="text-gray-400 text-sm text-center py-8">Сообщения не найдены</div>
              ) : (
                filteredMessages.map((m) => {
                  const isOwnAuthor =
                    Boolean(currentUserId && m.author.id === currentUserId) && !m.isSystem
                  const isDeleted = Boolean(m.deletedAt)
                  const showActions = isOwnAuthor && !isDeleted
                  const avatarUrl = m.author.avatarUrl ?? null

                  const editBlock =
                    editingId === m.id ? (
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
                    ) : null

                  const bodyBlock =
                    editingId === m.id ? (
                      editBlock
                    ) : isDeleted ? (
                      <div className="italic text-gray-400">Сообщение удалено</div>
                    ) : (
                      <>
                        <div className="whitespace-pre-wrap break-words">{m.body}</div>
                        {m.editedAt && <div className="text-[10px] text-gray-400 mt-1">изменено</div>}
                      </>
                    )

                  const actionButtons = showActions && (
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
                  )

                  if (m.isSystem) {
                    return (
                      <div key={m.id} className="flex justify-center">
                        <div className="relative group mx-auto max-w-[95%] rounded-xl px-3 py-2 text-sm bg-amber-50 border border-amber-100 text-amber-900 text-center">
                          <div className="whitespace-pre-wrap break-words">{m.body}</div>
                          <div className="text-[10px] text-amber-700/80 mt-1">{formatTime(m.createdAt)}</div>
                        </div>
                      </div>
                    )
                  }

                  if (isCommentsRoom && isEngineerInternalComment(m.metadata)) {
                    const meta = m.metadata
                    const ack = meta.acknowledged
                    return (
                      <div key={m.id} className="flex justify-start w-full">
                        <div className="w-full max-w-[95%] rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3 text-sm">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="font-semibold text-violet-950">Внутренний комментарий инженера</div>
                              <div className="text-xs text-violet-900/80 space-y-0.5">
                                <div>Филиал: {meta.branchName}</div>
                                <div>
                                  Оборудование: {meta.equipmentBrand} {meta.equipmentModel} ({meta.serialNumber})
                                </div>
                                <div>Задача №{meta.taskNumber}</div>
                                <div>Инженер: {m.author.name}</div>
                                <div>{formatTime(m.createdAt)}</div>
                              </div>
                              <div className="pt-2 whitespace-pre-wrap break-words text-gray-900">
                                {meta.commentText}
                              </div>
                            </div>
                            <div className="shrink-0">
                              {ack ? (
                                <div className="text-xs text-green-800 bg-green-50 border border-green-200 rounded-lg px-2 py-1.5 whitespace-nowrap">
                                  Принял: {ack.userName} в {formatTime(ack.at)}
                                </div>
                              ) : canAckComments ? (
                                <button
                                  type="button"
                                  disabled={acknowledgingId === m.id}
                                  onClick={() => void acknowledgeComment(m.id)}
                                  className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
                                >
                                  {acknowledgingId === m.id ? '…' : 'Принято'}
                                </button>
                              ) : (
                                <div className="text-xs text-gray-500 italic">Ожидает принятия</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  if (isGeneralRoom) {
                    return (
                      <div key={m.id} className="flex gap-2 items-start w-full">
                        <SenderAvatar name={m.author.name} avatarUrl={avatarUrl} />
                        <div
                          className={`relative group flex-1 min-w-0 rounded-xl px-3 py-2 text-sm border ${
                            isOwnAuthor ? 'bg-blue-50 border-blue-100' : 'bg-white border-gray-200 shadow-sm'
                          }`}
                        >
                          {actionButtons}
                          <div className="text-xs text-gray-600 mb-1 pr-14 flex flex-wrap items-baseline gap-x-2 gap-y-0">
                            <span className="font-semibold text-gray-900">{m.author.name}</span>
                            <span className="text-gray-400">{formatTime(m.createdAt)}</span>
                          </div>
                          {bodyBlock}
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={m.id}
                      className={`flex ${isOwnAuthor ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`relative group max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                          isOwnAuthor ? 'bg-blue-50 border border-blue-100' : 'bg-white border shadow-sm'
                        }`}
                      >
                        {actionButtons}
                        <div className="text-xs text-gray-500 mb-1 pr-12">
                          <span className="font-medium text-gray-700">{m.author.name}</span>
                          <span className="ml-2">{formatTime(m.createdAt)}</span>
                        </div>
                        {bodyBlock}
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={bottomRef} />
            </div>
            {!isCommentsRoom && (
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
            )}
          </>
        )}
      </section>
    </div>
  )
}

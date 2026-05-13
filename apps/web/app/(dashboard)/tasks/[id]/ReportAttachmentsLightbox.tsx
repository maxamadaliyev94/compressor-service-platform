'use client'

import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'

export type ReportAttachmentView = {
  id: string
  url: string
  caption: string | null
}

export default function ReportAttachmentsLightbox({ attachments }: { attachments: ReportAttachmentView[] }) {
  const [index, setIndex] = useState<number | null>(null)

  const close = useCallback(() => setIndex(null), [])
  const active = index !== null ? attachments[index] : null

  useEffect(() => {
    if (index === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (attachments.length < 2) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setIndex((i) => (i === null ? null : (i + 1) % attachments.length))
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setIndex((i) => (i === null ? null : (i - 1 + attachments.length) % attachments.length))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, close, attachments.length])

  useEffect(() => {
    if (index === null) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [index])

  if (attachments.length === 0) return null

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {attachments.map((att, idx) => (
          <button
            key={att.id}
            type="button"
            onClick={() => setIndex(idx)}
            className="block w-full rounded-lg border border-gray-200 overflow-hidden bg-gray-50 hover:ring-2 hover:ring-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow text-left"
            title={att.caption || 'Открыть фото'}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={att.url} alt={att.caption || 'Фото отчёта'} className="w-full h-40 object-cover pointer-events-none" />
            {att.caption && (
              <div className="text-[10px] text-gray-500 px-2 py-1 truncate">{att.caption}</div>
            )}
          </button>
        ))}
      </div>

      {active && index !== null && (
        <div className="fixed inset-0 z-[100] bg-black/85" role="presentation">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              close()
            }}
            className="fixed top-4 right-4 z-[110] flex h-11 w-11 items-center justify-center rounded-full bg-white text-gray-800 shadow-lg border border-gray-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" strokeWidth={2.25} />
          </button>
          <div
            className="absolute inset-0 flex items-center justify-center p-4 pt-16 sm:pt-4"
            onClick={close}
            role="presentation"
          >
            <div
              className="relative max-w-full max-h-full flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Просмотр фотографии отчёта"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={active.url}
                alt={active.caption || 'Фото отчёта'}
                className="max-h-[min(88vh,calc(100dvh-5rem))] max-w-[min(96vw,1280px)] w-auto object-contain rounded-lg shadow-2xl"
              />
              {active.caption && (
                <p className="mt-3 max-w-[min(96vw,1280px)] text-center text-sm text-white/90 px-2">{active.caption}</p>
              )}
              {attachments.length > 1 && (
                <p className="mt-2 text-xs text-white/50">
                  {index + 1} / {attachments.length} · ← → для переключения
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

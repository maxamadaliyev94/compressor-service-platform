'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import EquipmentPhotoGallery from './EquipmentPhotoGallery'
import { MAX_EQUIPMENT_PHOTOS } from '@/lib/photo-limits'

type PhotoItem = {
  id: string
  url: string
}

export default function EquipmentPhotosEditor({
  equipmentId,
  photos,
  canEdit,
}: {
  equipmentId: string
  photos: PhotoItem[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [editorOpen, setEditorOpen] = useState(false)
  const [draftUrls, setDraftUrls] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editorOpen) {
      setDraftUrls(photos.map((p) => p.url))
    }
  }, [editorOpen, photos])

  function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function onPickPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const allowed = Math.max(0, MAX_EQUIPMENT_PHOTOS - draftUrls.length)
    const selected = files.slice(0, allowed)
    const loaded = await Promise.all(selected.map(readFileAsDataUrl))
    setDraftUrls((prev) => [...prev, ...loaded].slice(0, MAX_EQUIPMENT_PHOTOS))
    e.target.value = ''
  }

  function removeDraftAt(index: number) {
    setDraftUrls((prev) => prev.filter((_, i) => i !== index))
  }

  async function savePhotos() {
    setSaving(true)
    try {
      const res = await fetch(`/api/equipment/${equipmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photos: draftUrls }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert((data as { error?: string }).error ?? 'Не удалось сохранить фото')
        return
      }
      setEditorOpen(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white border rounded-xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <h2 className="font-semibold flex items-center gap-2">🖼️ Фото оборудования</h2>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditorOpen(true)}
            className="text-sm px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 shrink-0"
          >
            Редактировать фото
          </button>
        )}
      </div>

      {photos.length === 0 ? (
        <p className="text-sm text-gray-400">Фото пока не добавлены</p>
      ) : (
        <EquipmentPhotoGallery photos={photos} />
      )}

      {editorOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => !saving && setEditorOpen(false)}
          role="presentation"
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5"
            role="dialog"
            aria-modal="true"
            aria-label="Редактирование фото оборудования"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2">Редактировать фото</h3>
            <p className="text-sm text-gray-600 mb-4">
              Удалите ненужные снимки и при необходимости добавьте новые (до {MAX_EQUIPMENT_PHOTOS} шт.).
            </p>

            <label className="block text-sm font-medium mb-1">Добавить фотографии</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => void onPickPhotos(e)}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-2"
            />
            <p className="text-xs text-gray-400 mb-4">
              Выбрано: {draftUrls.length} / {MAX_EQUIPMENT_PHOTOS}
            </p>

            {draftUrls.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                {draftUrls.map((url, idx) => (
                  <div key={`${idx}-${url.slice(0, 32)}`} className="relative border rounded-lg overflow-hidden bg-gray-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Фото ${idx + 1}`} className="w-full h-28 object-cover" />
                    <button
                      type="button"
                      onClick={() => removeDraftAt(idx)}
                      className="absolute top-1 right-1 bg-white/90 text-red-600 border rounded px-1.5 text-xs hover:bg-white"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-4">Нет фото — добавьте файлы выше.</p>
            )}

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                disabled={saving}
                className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void savePhotos()}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

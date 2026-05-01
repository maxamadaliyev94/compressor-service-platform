'use client'

import { useState } from 'react'

type PhotoItem = {
  id: string
  url: string
}

export default function EquipmentPhotoGallery({ photos }: { photos: PhotoItem[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const close = () => setActiveIndex(null)
  const activePhoto = activeIndex !== null ? photos[activeIndex] : null

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {photos.map((photo, idx) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setActiveIndex(idx)}
            className="block border rounded-lg overflow-hidden bg-gray-50 hover:opacity-90 transition-opacity text-left"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt={`Фото оборудования ${idx + 1}`} className="w-full h-36 object-cover" />
          </button>
        ))}
      </div>

      {activePhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={close}
          role="presentation"
        >
          <div
            className="relative w-full max-w-5xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Просмотр фото оборудования"
          >
            <button
              type="button"
              onClick={close}
              className="absolute -top-10 right-0 text-white border border-white/40 rounded px-3 py-1 text-sm hover:bg-white/10"
            >
              Закрыть
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activePhoto.url}
              alt={`Фото оборудования ${activeIndex + 1}`}
              className="w-full max-h-[85vh] object-contain rounded-lg bg-black"
            />
          </div>
        </div>
      )}
    </>
  )
}

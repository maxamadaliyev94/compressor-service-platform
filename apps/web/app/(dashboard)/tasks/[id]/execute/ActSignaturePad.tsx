'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'

type Variant = 'engineer' | 'client'

const PAD_HEIGHT = 160

export default function ActSignaturePad({
  variant,
  title,
  signedDataUrl,
  signedAt,
  onSigned,
  onReset,
}: {
  variant: Variant
  title: string
  signedDataUrl: string | null
  signedAt: Date | null
  onSigned: (dataUrl: string, at: Date) => void
  onReset: () => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const sigRef = useRef<SignatureCanvas>(null)
  const [canvasWidth, setCanvasWidth] = useState(340)

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const w = Math.floor(el.getBoundingClientRect().width)
      if (w < 1) return
      const next = Math.max(260, Math.min(640, w))
      setCanvasWidth((prev) => (prev === next ? prev : next))
    }
    measure()
    const ro = new ResizeObserver(() => measure())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const stampClass =
    variant === 'engineer'
      ? 'border-green-600 bg-green-50 text-green-800'
      : 'border-blue-600 bg-blue-50 text-blue-800'

  function clearPad() {
    sigRef.current?.clear()
  }

  function apply() {
    const inst = sigRef.current
    if (!inst || inst.isEmpty()) {
      alert('Нарисуйте подпись')
      return
    }
    const dataUrl = inst.toDataURL('image/png')
    onSigned(dataUrl, new Date())
    inst.clear()
  }

  if (signedDataUrl) {
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium text-gray-800">{title}</div>
        <div className="border rounded-lg p-3 bg-gray-50 flex flex-wrap items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={signedDataUrl} alt="" className="max-h-28 object-contain bg-white border rounded" />
          <div
            className={`border-2 border-dashed rounded-lg px-4 py-2 text-center text-xs font-bold uppercase ${stampClass}`}
          >
            <div>ПОДПИСАНО</div>
            <div className="font-normal normal-case font-medium mt-1">
              {signedAt ? signedAt.toLocaleString('ru-RU') : ''}
            </div>
          </div>
        </div>
        <button type="button" onClick={onReset} className="text-xs text-blue-600 hover:underline">
          Изменить подпись
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-gray-800">{title}</div>
      <div
        ref={wrapRef}
        className="w-full border rounded-lg overflow-hidden bg-white touch-none"
        style={{ touchAction: 'none' }}
      >
        <SignatureCanvas
          key={canvasWidth}
          ref={sigRef}
          penColor="#111827"
          canvasProps={{
            width: canvasWidth,
            height: PAD_HEIGHT,
            className: 'block',
            style: { width: canvasWidth, height: PAD_HEIGHT, maxWidth: '100%' },
          }}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={clearPad}
          className="flex-1 border border-gray-300 py-2 rounded-lg text-sm hover:bg-gray-50"
        >
          Очистить
        </button>
        <button
          type="button"
          onClick={apply}
          className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          Подписать
        </button>
      </div>
    </div>
  )
}

'use client'

export default function PrintQR({ serialNumber, brand, model, qrUrl }: {
  serialNumber: string, brand: string, model: string, qrUrl: string
}) {
  function print() {
    const win = window.open('', '_blank', 'width=400,height=500')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR — ${brand} ${model}</title>
        <style>
          body { font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
          .card { border: 2px solid #e5e7eb; border-radius: 12px; padding: 24px; text-align: center; max-width: 280px; }
          h2 { margin: 0 0 4px; font-size: 18px; color: #111; }
          p { margin: 0 0 16px; font-size: 13px; color: #6b7280; }
          img { width: 180px; height: 180px; }
          .serial { font-family: monospace; font-size: 12px; color: #374151; margin-top: 12px; background: #f3f4f6; padding: 6px 12px; border-radius: 6px; }
          .hint { font-size: 11px; color: #9ca3af; margin-top: 8px; }
          @media print { body { padding: 0; } .card { border: 1px solid #ccc; } }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>${brand} ${model}</h2>
          <p>Compressor Service Platform</p>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUrl)}" alt="QR"/>
          <div class="serial">${serialNumber}</div>
          <div class="hint">Сканируйте для просмотра карточки оборудования</div>
        </div>
        <script>setTimeout(() => { window.print(); }, 500)</script>
      </body>
      </html>
    `)
    win.document.close()
  }

  return (
    <button onClick={print}
      className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-2">
      🖨️ Печать QR
    </button>
  )
}

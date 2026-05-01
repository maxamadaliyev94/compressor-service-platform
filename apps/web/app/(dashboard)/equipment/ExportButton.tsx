'use client'
import * as XLSX from 'xlsx'

export default function ExportButton({ equipment }: { equipment: any[] }) {
  function exportExcel() {
    const rows = equipment.map((eq) => {
      const diff = eq.nextServiceHours ? eq.nextServiceHours - eq.currentHours : null
      let toStatus = 'Норма'
      if (diff !== null) {
        if (diff < 0) toStatus = 'Просрочено'
        else if (diff < 100) toStatus = 'Срочно ТО'
        else if (diff < 300) toStatus = 'Скоро ТО'
      }
      let wsStatus = 'Истекла'
      if (eq.warrantyVoided) wsStatus = 'Аннулирована'
      else if (eq.warrantyUntil) {
        const days = (new Date(eq.warrantyUntil).getTime() - Date.now()) / 86400000
        if (days > 30) wsStatus = 'На гарантии'
        else if (days >= 0) wsStatus = 'Истекает'
      }
      return {
        Бренд: eq.brand,
        Модель: eq.model,
        Тип: eq.type,
        'Серийный номер': eq.serialNumber,
        Клиент: eq.object?.branch?.client?.name || '',
        Объект: eq.object?.name || '',
        'Текущие моточасы': eq.currentHours,
        'Следующее ТО (м/ч)': eq.nextServiceHours || '',
        'Осталось до ТО': diff !== null ? diff : '',
        'Статус ТО': toStatus,
        'Гарантия до': eq.warrantyUntil ? new Date(eq.warrantyUntil).toLocaleDateString('ru-RU') : '',
        'Статус гарантии': wsStatus,
        'Дата установки': eq.installDate ? new Date(eq.installDate).toLocaleDateString('ru-RU') : '',
        'Год выпуска': eq.yearOfManufacture || '',
      }
    })

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Оборудование')

    ws['!cols'] = [
      { wch: 12 },
      { wch: 14 },
      { wch: 16 },
      { wch: 18 },
      { wch: 24 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 12 },
    ]

    XLSX.writeFile(wb, `Оборудование_${new Date().toLocaleDateString('ru-RU')}.xlsx`)
  }

  return (
    <button onClick={exportExcel} className="w-full md:w-auto min-h-11 border px-4 py-2 rounded-lg text-sm hover:bg-gray-50 flex items-center justify-center gap-2">
      📥 Экспорт Excel
    </button>
  )
}

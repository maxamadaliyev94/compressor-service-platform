'use client'
import * as XLSX from 'xlsx'

export default function ExportClientsButton({ clients }: { clients: any[] }) {
  function exportExcel() {
    const rows = clients.map((c) => {
      const equipCount = c.branches?.flatMap((b: any) => b.objects).flatMap((o: any) => o.equipment).length || 0
      const statusLabels: Record<string, string> = {
        VIP: 'VIP',
        STANDART: 'Стандарт',
        PASSIVE: 'Пассивный',
      }
      return {
        Название: c.name,
        ИНН: c.inn || '',
        'Контактное лицо': c.contactPerson || '',
        Телефон: c.phone || '',
        Email: c.email || '',
        Статус: statusLabels[c.status] || c.status,
        'Включён (учёт)': c.isActive === false ? 'Нет' : 'Да',
        'Кол-во оборудования': equipCount,
        Комментарий: c.comment || '',
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Клиенты')
    ws['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 24 }, { wch: 14 }, { wch: 18 }, { wch: 30 }]
    XLSX.writeFile(wb, `Клиенты_${new Date().toLocaleDateString('ru-RU')}.xlsx`)
  }

  return (
    <button onClick={exportExcel} className="w-full md:w-auto min-h-11 border px-4 py-2 rounded-lg text-sm hover:bg-gray-50 flex items-center justify-center gap-2">
      📥 Экспорт Excel
    </button>
  )
}

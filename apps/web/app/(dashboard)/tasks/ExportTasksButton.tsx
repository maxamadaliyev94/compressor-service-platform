'use client'

import * as XLSX from 'xlsx'
import { formatTaskScheduleRangeRu } from '@/lib/task-schedule-display'

type ExportTask = {
  requestNumber: number
  type: string
  status: string
  taskType?: string | null
  scheduledAt: Date | null
  startDate?: Date | null
  endDate?: Date | null
  equipment: {
    brand: string
    model: string
    serialNumber: string
    object: {
      name: string
      branch: {
        client: { name: string; city: string | null }
      }
    }
  }
  assignedTo: { name: string } | null
  report?: { clientSignature: string | null } | null
}

export default function ExportTasksButton({
  tasks,
  typeLabels,
  statusLabels,
}: {
  tasks: ExportTask[]
  typeLabels: Record<string, string>
  statusLabels: Record<string, string>
}) {
  function exportExcel() {
    const rows = tasks.map((t) => ({
      '№ заявки': t.requestNumber,
      Тип: typeLabels[t.type] || t.type,
      Оборудование: `${t.equipment.brand} ${t.equipment.model}`.trim(),
      'Серийный №': t.equipment.serialNumber || '',
      Объект: t.equipment.object.name,
      Клиент: t.equipment.object.branch.client.name,
      Город: t.equipment.object.branch.client.city || '',
      Инженер: t.assignedTo?.name || 'Не назначен',
      Срок: formatTaskScheduleRangeRu(t),
      Статус: statusLabels[t.status] || t.status,
      'Подпись клиента':
        t.status === 'DONE' ? (t.report?.clientSignature ? 'Да' : 'Нет') : '—',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Задачи')
    ws['!cols'] = [
      { wch: 10 },
      { wch: 18 },
      { wch: 28 },
      { wch: 14 },
      { wch: 22 },
      { wch: 26 },
      { wch: 14 },
      { wch: 22 },
      { wch: 12 },
      { wch: 14 },
      { wch: 18 },
    ]
    const stamp = new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')
    XLSX.writeFile(wb, `Задачи_${stamp}.xlsx`)
  }

  return (
    <button
      type="button"
      onClick={exportExcel}
      disabled={tasks.length === 0}
      className="text-sm border rounded-lg px-2.5 py-1.5 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap"
    >
      📥 Excel
    </button>
  )
}

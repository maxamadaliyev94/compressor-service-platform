import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const task = await db.serviceTask.findUnique({
    where: { id: params.id },
    include: {
      equipment: {
        include: { object: { include: { branch: { include: { client: true } } } } },
      },
      assignedTo: true,
      report: {
        include: { checklistItems: true, partsUsed: true },
      },
    },
  })

  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const eq = task.equipment
  const client = eq.object.branch.client

  const typeLabels: Record<string, string> = {
    PLANNED_MAINTENANCE: 'Плановое ТО',
    DIAGNOSTICS: 'Диагностика',
    WARRANTY_REPAIR: 'Гарантийный ремонт',
    EMERGENCY: 'Аварийный выезд',
    INSTALLATION: 'Монтаж',
    COMMISSIONING: 'Пусконаладка',
  }

  const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; margin: 40px; color: #333; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .subtitle { color: #666; margin-bottom: 20px; }
  .section { margin-bottom: 16px; }
  .section-title { font-size: 13px; font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 8px; color: #444; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .field { margin-bottom: 6px; }
  .label { color: #888; font-size: 11px; }
  .value { font-weight: 500; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #f5f5f5; text-align: left; padding: 6px 8px; font-size: 11px; border: 1px solid #ddd; }
  td { padding: 6px 8px; border: 1px solid #ddd; font-size: 11px; }
  .checklist { list-style: none; padding: 0; }
  .checklist li { padding: 3px 0; }
  .checked { color: #16a34a; }
  .unchecked { color: #dc2626; }
  .footer { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .sig-line { border-top: 1px solid #333; margin-top: 40px; padding-top: 4px; font-size: 11px; color: #666; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; background: #dbeafe; color: #1d4ed8; }
</style>
</head>
<body>
<div style="display:flex; justify-content:space-between; align-items:flex-start;">
  <div>
    <h1>АКТ ВЫПОЛНЕННЫХ РАБОТ</h1>
    <p class="subtitle">№ ${task.id.slice(-8).toUpperCase()} · ${new Date().toLocaleDateString('ru-RU')}</p>
  </div>
  <div style="text-align:right;">
    <div class="badge">${typeLabels[task.type] || task.type}</div>
  </div>
</div>

<div class="section">
  <div class="section-title">Данные клиента</div>
  <div class="grid">
    <div class="field"><div class="label">Компания</div><div class="value">${client.name}</div></div>
    <div class="field"><div class="label">Контактное лицо</div><div class="value">${client.contactPerson || '—'}</div></div>
    <div class="field"><div class="label">Телефон</div><div class="value">${client.phone || '—'}</div></div>
    <div class="field"><div class="label">Объект</div><div class="value">${eq.object.name}, ${eq.object.branch.name}</div></div>
    <div class="field"><div class="label">Адрес</div><div class="value">${eq.object.branch.address || '—'}</div></div>
  </div>
</div>

<div class="section">
  <div class="section-title">Данные оборудования</div>
  <div class="grid">
    <div class="field"><div class="label">Тип / Бренд / Модель</div><div class="value">${eq.type} · ${eq.brand} ${eq.model}</div></div>
    <div class="field"><div class="label">Серийный номер</div><div class="value">${eq.serialNumber}</div></div>
    <div class="field"><div class="label">Год выпуска</div><div class="value">${eq.yearOfManufacture || '—'}</div></div>
    <div class="field"><div class="label">Гарантия до</div><div class="value">${eq.warrantyUntil ? new Date(eq.warrantyUntil).toLocaleDateString('ru-RU') : '—'}</div></div>
    <div class="field"><div class="label">Моточасы на момент работы</div><div class="value">${task.report?.currentHours ?? eq.currentHours} м/ч</div></div>
    <div class="field"><div class="label">Следующее ТО</div><div class="value">${task.report?.nextServiceHours ?? eq.nextServiceHours ?? '—'} м/ч</div></div>
  </div>
</div>

<div class="section">
  <div class="section-title">Выполненные работы</div>
  ${
    task.report?.checklistItems && task.report.checklistItems.length > 0
      ? `
  <ul class="checklist">
    ${task.report.checklistItems
      .map(
        (item) => `
      <li class="${item.checked ? 'checked' : 'unchecked'}">
        ${item.checked ? '✓' : '✗'} ${item.label}
      </li>
    `
      )
      .join('')}
  </ul>
  `
      : '<p style="color:#888">Чек-лист не заполнен</p>'
  }
</div>

${
  task.report?.partsUsed && task.report.partsUsed.length > 0
    ? `
<div class="section">
  <div class="section-title">Использованные запчасти и расходники</div>
  <table>
    <thead><tr><th>Наименование</th><th>Артикул</th><th>Кол-во</th><th>Ед. изм.</th></tr></thead>
    <tbody>
      ${task.report.partsUsed.map((p) => `<tr><td>${p.name}</td><td>${p.article || '—'}</td><td>${p.quantity}</td><td>${p.unit}</td></tr>`).join('')}
    </tbody>
  </table>
</div>
`
    : ''
}

${
  task.report?.recommendations
    ? `
<div class="section">
  <div class="section-title">Рекомендации клиенту</div>
  <p>${task.report.recommendations}</p>
</div>
`
    : ''
}

<div class="section">
  <div class="section-title">Данные о работе</div>
  <div class="grid">
    <div class="field"><div class="label">Инженер</div><div class="value">${task.assignedTo?.name || '—'}</div></div>
    <div class="field"><div class="label">Дата выполнения</div><div class="value">${
      task.scheduledAt ? new Date(task.scheduledAt).toLocaleDateString('ru-RU') : new Date().toLocaleDateString('ru-RU')
    }</div></div>
  </div>
</div>

<div class="footer">
  <div>
    <div class="sig-line">Подпись инженера: ${task.assignedTo?.name || '_______________'}</div>
  </div>
  <div>
    <div class="sig-line">Подпись клиента: ${client.contactPerson || '_______________'}</div>
  </div>
</div>
</body>
</html>
  `

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}

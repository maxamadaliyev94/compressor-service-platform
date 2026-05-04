import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { canReadTask, type AuthedSession } from '@/lib/api-access'
import { checklistActionLabelRu } from '@/lib/checklist-diagnostics'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = await canReadTask(session as AuthedSession, params.id)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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

  if (!task || task.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  const eq = task.equipment
  const client = eq.object.branch.client
  const report = task.report
  const engineerName = task.assignedTo?.name || '—'
  const clientSignerName = client.contactPerson?.trim() || client.name || '—'

  const checkedItems = report?.checklistItems?.filter((item) => item.checked) ?? []

  const roomCondition = report?.roomCondition ?? ''
  const extractMetric = (re: RegExp) => {
    const m = roomCondition.match(re)
    return m?.[1] ?? '—'
  }

  const voltageL1 = extractMetric(/L1=([^V;]+)V/)
  const voltageL2 = extractMetric(/L2=([^V;]+)V/)
  const voltageL3 = extractMetric(/L3=([^V;]+)V/)
  const currentL1 = extractMetric(/Ф1=([^A;]+)A/)
  const currentL2 = extractMetric(/Ф2=([^A;]+)A/)
  const currentL3 = extractMetric(/Ф3=([^A;]+)A/)
  const pressureLower = extractMetric(/Давление нижнее:\s*([^б;]+)\s*бар/)
  const loadHours = extractMetric(/Моточасы под нагрузкой:\s*([^;]+)/)

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
  .footer { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 32px; align-items: start; }
  .sig-block { min-width: 0; }
  .sig-label { font-size: 11px; color: #555; margin-bottom: 8px; font-weight: 600; }
  .sig-row {
    display: flex; align-items: flex-end; justify-content: space-between; gap: 12px;
    border: 1px solid #e5e7eb; border-radius: 4px; padding: 10px 12px; background: #fafafa; min-height: 88px;
  }
  .sig-img-wrap { flex: 1; min-width: 120px; display: flex; align-items: center; justify-content: flex-start; }
  .sig-img-wrap img { max-height: 80px; max-width: 100%; object-fit: contain; display: block; }
  .sig-placeholder { color: #ccc; font-size: 12px; user-select: none; }
  .stamp {
    flex-shrink: 0; text-align: center; padding: 10px 14px; border: 1px solid; border-radius: 2px;
    font-size: 10px; line-height: 1.45; max-width: 210px;
  }
  .stamp--engineer { border-color: #86efac; background: #f0fdf4; color: #166534; }
  .stamp--engineer .stamp-title { font-weight: 700; font-size: 11px; letter-spacing: 0.06em; margin-bottom: 4px; }
  .stamp--engineer .stamp-time { font-size: 9px; font-weight: 500; color: #15803d; margin-bottom: 3px; }
  .stamp--engineer .stamp-by { font-size: 9px; color: #14532d; }
  .stamp--client { border-color: #93c5fd; background: #eff6ff; color: #1e40af; }
  .stamp--client .stamp-title { font-weight: 700; font-size: 11px; letter-spacing: 0.06em; margin-bottom: 4px; }
  .stamp--client .stamp-time { font-size: 9px; font-weight: 500; color: #2563eb; margin-bottom: 3px; }
  .stamp--client .stamp-by { font-size: 9px; color: #1e3a8a; }
  .badge {
    display: inline-block;
    padding: 5px 12px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    background: #dbeafe;
    color: #1d4ed8;
  }
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
    checkedItems.length > 0
      ? `
  <ul class="checklist">
    ${checkedItems
      .map(
        (item) => `
      <li class="checked">
        ✓ ${esc(item.label)}${
          item.performedAction
            ? ` — <span style="font-weight:600">${esc(checklistActionLabelRu(item.performedAction))}</span>`
            : ''
        }
      </li>
    `
      )
      .join('')}
  </ul>
  `
      : '<p style="color:#888">Выполненные позиции не отмечены</p>'
  }
</div>

<div class="section">
  <div class="section-title">Показатели</div>
  <div class="grid">
    <div class="field"><div class="label">Напряжение L1</div><div class="value">${voltageL1} V</div></div>
    <div class="field"><div class="label">Напряжение L2</div><div class="value">${voltageL2} V</div></div>
    <div class="field"><div class="label">Напряжение L3</div><div class="value">${voltageL3} V</div></div>

    <div class="field"><div class="label">Ток фаза 1</div><div class="value">${currentL1} A</div></div>
    <div class="field"><div class="label">Ток фаза 2</div><div class="value">${currentL2} A</div></div>
    <div class="field"><div class="label">Ток фаза 3</div><div class="value">${currentL3} A</div></div>

    <div class="field"><div class="label">Температура окружающей среды</div><div class="value">${report?.airTemp ?? '—'} °C</div></div>
    <div class="field"><div class="label">Температура масла</div><div class="value">${report?.oilTemp ?? '—'} °C</div></div>

    <div class="field"><div class="label">Давление (верхнее)</div><div class="value">${report?.pressure ?? '—'} бар</div></div>
    <div class="field"><div class="label">Давление (нижнее)</div><div class="value">${pressureLower} бар</div></div>

    <div class="field"><div class="label">Моточасы под нагрузкой</div><div class="value">${loadHours}</div></div>
    <div class="field"><div class="label">Моточасы текущие</div><div class="value">${report?.currentHours ?? '—'} м/ч</div></div>
  </div>
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
  <div class="sig-block">
    <div class="sig-label">Подпись инженера</div>
    <div class="sig-row">
      <div class="sig-img-wrap">
        ${
          report?.engineerSignature
            ? `<img src="${report.engineerSignature}" alt="" />`
            : '<span class="sig-placeholder">________________</span>'
        }
      </div>
      ${
        report?.engineerSignedAt
          ? `<div class="stamp stamp--engineer">
            <div class="stamp-title">ПОДПИСАНО</div>
            <div class="stamp-time">${esc(
              new Date(report.engineerSignedAt).toLocaleString('ru-RU', {
                dateStyle: 'short',
                timeStyle: 'medium',
              })
            )}</div>
            <div class="stamp-by">${esc(engineerName)}</div>
          </div>`
          : ''
      }
    </div>
  </div>
  <div class="sig-block">
    <div class="sig-label">Подпись клиента</div>
    <div class="sig-row">
      <div class="sig-img-wrap">
        ${
          report?.clientSignature
            ? `<img src="${report.clientSignature}" alt="" />`
            : '<span class="sig-placeholder">________________</span>'
        }
      </div>
      ${
        report?.clientSignedAt
          ? `<div class="stamp stamp--client">
            <div class="stamp-title">ПОДПИСАНО</div>
            <div class="stamp-time">${esc(
              new Date(report.clientSignedAt).toLocaleString('ru-RU', {
                dateStyle: 'short',
                timeStyle: 'medium',
              })
            )}</div>
            <div class="stamp-by">${esc(clientSignerName)}</div>
          </div>`
          : ''
      }
    </div>
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

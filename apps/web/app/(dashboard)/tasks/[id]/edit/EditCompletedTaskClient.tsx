'use client'

import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { ChecklistItemAction } from '@prisma/client'
import {
  CHECKLIST_ACTION_LABELS,
  isDiagnosticsChecklistAutoRowLabel,
  isValidDiagnosticsActionForLabel,
  needsDiagnosticsPerformedAction,
  validDiagnosticsActionsForLabel,
} from '@/lib/checklist-diagnostics'

type ChecklistRow = {
  id: string
  label: string
  checked: boolean
  isAuto: boolean
  action: ChecklistItemAction | null
}
type PartRow = { id: string; name: string; quantity: string; unit: string }

export default function EditCompletedTaskClient({ task }: { task: any }) {
  const router = useRouter()
  const diagnosticsChecklistActions = task.type === 'DIAGNOSTICS'
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    comment: task.comment || '',
    scheduledAt: task.scheduledAt ? new Date(task.scheduledAt).toISOString().slice(0, 16) : '',
    priority: task.priority,
    currentHours: String(task.report.currentHours ?? ''),
    nextServiceHours: task.report.nextServiceHours != null ? String(task.report.nextServiceHours) : '',
    pressure: task.report.pressure != null ? String(task.report.pressure) : '',
    oilTemp: task.report.oilTemp != null ? String(task.report.oilTemp) : '',
    airTemp: task.report.airTemp != null ? String(task.report.airTemp) : '',
    roomCondition: task.report.roomCondition || '',
    notes: task.report.notes || '',
    recommendations: task.report.recommendations || '',
  })
  const [checklist, setChecklist] = useState<ChecklistRow[]>(
    (task.report.checklistItems || []).map((i: any) => ({
      id: i.id,
      label: i.label,
      checked: Boolean(i.checked),
      isAuto: isDiagnosticsChecklistAutoRowLabel(String(i.label)),
      action: (i.performedAction as ChecklistItemAction | null) ?? null,
    }))
  )
  const [partsUsed, setPartsUsed] = useState<PartRow[]>(
    (task.report.partsUsed || []).map((p: any) => ({
      id: p.id,
      name: p.name || '',
      quantity: String(p.quantity ?? ''),
      unit: p.unit || 'шт',
    }))
  )
  const [reportPhotos, setReportPhotos] = useState<string[]>(
    (task.report.attachments || []).map((a: any) => a.url).filter((u: unknown) => typeof u === 'string')
  )

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function addPartRow() {
    setPartsUsed((prev) => [...prev, { id: `new-${Date.now()}`, name: '', quantity: '1', unit: 'шт' }])
  }

  function updatePartRow(index: number, key: keyof PartRow, value: string) {
    setPartsUsed((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)))
  }

  function removePartRow(index: number) {
    setPartsUsed((prev) => prev.filter((_, i) => i !== index))
  }

  function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function onPickReportPhotos(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const allowed = Math.max(0, 10 - reportPhotos.length)
    const selected = files.slice(0, allowed)
    const loaded = await Promise.all(selected.map(readFileAsDataUrl))
    setReportPhotos((prev) => [...prev, ...loaded].slice(0, 10))
    e.target.value = ''
  }

  function setChecklistAction(index: number, action: ChecklistItemAction) {
    setChecklist((prev) => prev.map((row, i) => (i === index ? { ...row, action } : row)))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (diagnosticsChecklistActions) {
      for (const row of checklist) {
        if (
          needsDiagnosticsPerformedAction(row) &&
          !isValidDiagnosticsActionForLabel(row.label, row.action)
        ) {
          alert('Для диагностики у каждого отмеченного пункта выберите действие.')
          return
        }
      }
    }
    setLoading(true)
    const res = await fetch(`/api/tasks/${task.id}/edit`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        comment: form.comment,
        scheduledAt: form.scheduledAt || null,
        priority: form.priority,
        report: {
          currentHours: Number(form.currentHours),
          nextServiceHours: form.nextServiceHours === '' ? null : Number(form.nextServiceHours),
          pressure: form.pressure === '' ? null : Number(form.pressure),
          oilTemp: form.oilTemp === '' ? null : Number(form.oilTemp),
          airTemp: form.airTemp === '' ? null : Number(form.airTemp),
          roomCondition: form.roomCondition || null,
          notes: form.notes,
          recommendations: form.recommendations,
          checklist: checklist.map((item) => ({
            label: item.label,
            checked: item.checked,
            isAuto: item.isAuto,
            action: diagnosticsChecklistActions && needsDiagnosticsPerformedAction(item) ? item.action : null,
          })),
          partsUsed: partsUsed
            .filter((p) => p.name.trim())
            .map((p) => ({
              name: p.name.trim(),
              quantity: Number(p.quantity) || 1,
              unit: p.unit || 'шт',
            })),
          reportPhotos,
        },
      }),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Не удалось сохранить изменения')
      return
    }
    router.push(`/tasks/${task.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="bg-white border rounded-xl p-5 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Приоритет</label>
          <select
            value={form.priority}
            onChange={(e) => set('priority', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          >
            <option value="LOW">Низкий</option>
            <option value="MEDIUM">Средний</option>
            <option value="HIGH">Высокий</option>
            <option value="EMERGENCY">Аварийный</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Срок выполнения</label>
          <input
            type="datetime-local"
            value={form.scheduledAt}
            onChange={(e) => set('scheduledAt', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Моточасы (отчёт)</label>
          <input
            type="number"
            value={form.currentHours}
            onChange={(e) => set('currentHours', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Следующее ТО</label>
          <input
            type="number"
            value={form.nextServiceHours}
            onChange={(e) => set('nextServiceHours', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Давление (верхнее), бар</label>
          <input
            type="number"
            value={form.pressure}
            onChange={(e) => set('pressure', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Температура масла, °C</label>
          <input
            type="number"
            value={form.oilTemp}
            onChange={(e) => set('oilTemp', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Температура среды, °C</label>
          <input
            type="number"
            value={form.airTemp}
            onChange={(e) => set('airTemp', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Комментарий задачи</label>
        <textarea
          rows={3}
          value={form.comment}
          onChange={(e) => set('comment', e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Комментарий инженера</label>
        <textarea
          rows={3}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Рекомендации</label>
        <textarea
          rows={3}
          value={form.recommendations}
          onChange={(e) => set('recommendations', e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Показатели (строкой)</label>
        <textarea
          rows={2}
          value={form.roomCondition}
          onChange={(e) => set('roomCondition', e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Чек-лист работ</label>
        {diagnosticsChecklistActions && (
          <p className="text-xs text-blue-700 mb-2">
            Для диагностики у отмеченных пунктов (кроме строки типа работ) укажите действие — оно отображается в акте.
          </p>
        )}
        <div className="space-y-3 border rounded-lg p-3 bg-gray-50">
          {checklist.length === 0 && <div className="text-sm text-gray-500">Нет пунктов чек-листа</div>}
          {checklist.map((item, idx) => (
            <div key={item.id} className="text-sm space-y-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={item.checked}
                  disabled={item.isAuto}
                  onChange={() =>
                    setChecklist((prev) =>
                      prev.map((row, i) =>
                        i === idx
                          ? { ...row, checked: !row.checked, action: !row.checked ? row.action : null }
                          : row
                      )
                    )
                  }
                  className="w-4 h-4 mt-0.5 accent-blue-600 shrink-0 disabled:opacity-50"
                />
                <span className="flex-1">
                  {item.label}
                  {item.isAuto && <span className="text-xs text-blue-600 ml-2">авто</span>}
                  {diagnosticsChecklistActions && needsDiagnosticsPerformedAction(item) && item.action && (
                    <span className="block sm:inline sm:ml-2 mt-1 sm:mt-0 text-xs font-medium px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-100">
                      {CHECKLIST_ACTION_LABELS[item.action]}
                    </span>
                  )}
                </span>
              </label>
              {diagnosticsChecklistActions && needsDiagnosticsPerformedAction(item) && (
                <div className="pl-6 flex flex-wrap gap-2">
                  {validDiagnosticsActionsForLabel(item.label).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setChecklistAction(idx, a)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-lg border ${
                        item.action === a
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      {CHECKLIST_ACTION_LABELS[a]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium">Запчасти и расходники</label>
          <button
            type="button"
            onClick={addPartRow}
            className="border rounded-md px-2 py-1 text-xs hover:bg-gray-50"
          >
            + Добавить
          </button>
        </div>
        <div className="space-y-2">
          {partsUsed.length === 0 && <div className="text-sm text-gray-500">Запчасти не добавлены</div>}
          {partsUsed.map((p, idx) => (
            <div key={p.id} className="grid grid-cols-12 gap-2">
              <input
                value={p.name}
                onChange={(e) => updatePartRow(idx, 'name', e.target.value)}
                placeholder="Название"
                className="col-span-6 border rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="number"
                value={p.quantity}
                onChange={(e) => updatePartRow(idx, 'quantity', e.target.value)}
                placeholder="Кол-во"
                className="col-span-3 border rounded-lg px-3 py-2 text-sm"
              />
              <input
                value={p.unit}
                onChange={(e) => updatePartRow(idx, 'unit', e.target.value)}
                placeholder="Ед."
                className="col-span-2 border rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => removePartRow(idx)}
                className="col-span-1 border rounded-lg text-red-600 text-sm hover:bg-red-50"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Фото отчета (до 10 шт.)</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={onPickReportPhotos}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <p className="text-xs text-gray-400 mt-1">Загружено: {reportPhotos.length} / 10</p>
        {reportPhotos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {reportPhotos.map((src, idx) => (
              <div key={`${idx}-${src.slice(0, 24)}`} className="relative border rounded-lg overflow-hidden bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Фото отчета ${idx + 1}`} className="w-full h-24 object-cover" />
                <button
                  type="button"
                  onClick={() => setReportPhotos((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute top-1 right-1 bg-white/90 text-red-600 border rounded px-1.5 text-xs"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Сохранение...' : 'Сохранить изменения'}
        </button>
        <a href={`/tasks/${task.id}`} className="border px-5 py-2 rounded-lg text-sm hover:bg-gray-50">
          Отмена
        </a>
      </div>
    </form>
  )
}

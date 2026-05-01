'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  equipmentId: string
  currentHours: number
  nextServiceHours: number | null
}

export default function UpdateHours({ equipmentId, currentHours, nextServiceHours }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [hours, setHours] = useState(String(currentHours))
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Калькулятор режима работы
  const [hoursPerDay, setHoursPerDay] = useState('')
  const [daysPerWeek, setDaysPerWeek] = useState('5')
  const [showCalc, setShowCalc] = useState(false)

  const newHours = parseInt(hours) || 0
  const remaining = nextServiceHours ? nextServiceHours - newHours : null
  // Расчёт даты следующего ТО
  const calcResult = (() => {
    if (!hoursPerDay || !daysPerWeek || !remaining || remaining <= 0) return null
    const hpd = parseFloat(hoursPerDay)
    const dpw = parseFloat(daysPerWeek)
    if (!hpd || !dpw) return null
    const hoursPerWeek = hpd * dpw
    const weeksLeft = remaining / hoursPerWeek
    const daysLeft = Math.ceil(weeksLeft * 7)
    const date = new Date()
    date.setDate(date.getDate() + daysLeft)
    return {
      daysLeft,
      weeksLeft: Math.ceil(weeksLeft),
      date: date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
      hoursPerWeek: hoursPerWeek.toFixed(1),
    }
  })()
  const getStatus = () => {
    if (!remaining && remaining !== 0) return null
    if (remaining < 0) return { label: `Просрочено на ${Math.abs(remaining)} м/ч`, color: 'text-red-600 bg-red-50 border-red-200' }
    if (remaining < 100) return { label: `Срочно! Осталось ${remaining} м/ч`, color: 'text-orange-600 bg-orange-50 border-orange-200' }
    if (remaining < 300) return { label: `Скоро ТО — осталось ${remaining} м/ч`, color: 'text-yellow-600 bg-yellow-50 border-yellow-200' }
    return { label: `Норма — осталось ${remaining} м/ч`, color: 'text-green-600 bg-green-50 border-green-200' }
  }

  async function save() {
    const h = parseInt(hours)
    if (!h && h !== 0) { setError('Введите корректное значение'); return }
    setError('')
    setLoading(true)
    const res = await fetch(`/api/equipment/${equipmentId}/hours`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentHours: h, reason })
    })
    setLoading(false)
    if (res.ok) { setEditing(false); router.refresh() }
    else setError('Ошибка сохранения')
  }

  const status = getStatus()

  return (
    <div className="bg-white border rounded-xl p-5">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold">Моточасы и режим работы</h2>
        {!editing && (
          <button onClick={() => setEditing(true)}
            className="text-xs text-blue-600 border border-blue-200 px-3 py-1 rounded-lg hover:bg-blue-50">
            ✏️ Обновить
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Текущие моточасы
            </label>
            <input
              type="number"
              value={hours}
              onChange={e => { setHours(e.target.value); setError('') }}
              className="w-full border-2 border-blue-500 rounded-xl px-4 py-3 text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-300"
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1 text-center">
              Предыдущее значение: {currentHours} м/ч
            </p>
          </div>

          {nextServiceHours && hours && (
            <div className={`border rounded-xl p-3 text-center text-sm font-medium ${status?.color}`}>
              {status?.label}
              <div className="text-xs mt-1 opacity-75">
                Следующее ТО: {nextServiceHours} м/ч
              </div>
            </div>
          )}

          <div className="border rounded-xl overflow-hidden">
            <button type="button" onClick={() => setShowCalc(!showCalc)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium">
              <div className="flex items-center gap-2">
                <span>🕐</span>
                <span>Калькулятор режима работы</span>
              </div>
              <span className="text-gray-400">{showCalc ? '▲' : '▼'}</span>
            </button>

            {showCalc && (
              <div className="p-4 space-y-4">
                <p className="text-xs text-gray-500">
                  Укажите режим работы компрессора — система рассчитает когда подойдёт следующее ТО
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Часов в день
                    </label>
                    <div className="relative">
                      <input type="number" value={hoursPerDay}
                        onChange={e => setHoursPerDay(e.target.value)}
                        placeholder="8"
                        min="1" max="24" step="0.5"
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"/>
                      <span className="absolute right-3 top-2 text-xs text-gray-400">ч/д</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Дней в неделю
                    </label>
                    <select value={daysPerWeek} onChange={e => setDaysPerWeek(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="7">7 дней (24/7)</option>
                      <option value="6">6 дней</option>
                      <option value="5">5 дней (пн-пт)</option>
                      <option value="4">4 дня</option>
                      <option value="3">3 дня</option>
                      <option value="2">2 дня</option>
                      <option value="1">1 день</option>
                    </select>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-400 mb-2">Быстрый выбор:</p>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { label: '24/7', h: '24', d: '7' },
                      { label: '16ч/7д', h: '16', d: '7' },
                      { label: '8ч/5д', h: '8', d: '5' },
                      { label: '12ч/6д', h: '12', d: '6' },
                      { label: '10ч/5д', h: '10', d: '5' },
                    ].map(preset => (
                      <button key={preset.label} type="button"
                        onClick={() => { setHoursPerDay(preset.h); setDaysPerWeek(preset.d) }}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                          hoursPerDay === preset.h && daysPerWeek === preset.d
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'hover:bg-gray-50 text-gray-600'
                        }`}>
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {calcResult && remaining && remaining > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="text-center mb-3">
                      <div className="text-xs text-blue-600 font-medium mb-1">Следующее ТО ориентировочно:</div>
                      <div className="text-xl font-bold text-blue-800">{calcResult.date}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white rounded-lg p-2">
                        <div className="text-lg font-bold text-gray-800">{calcResult.daysLeft}</div>
                        <div className="text-xs text-gray-500">дней</div>
                      </div>
                      <div className="bg-white rounded-lg p-2">
                        <div className="text-lg font-bold text-gray-800">{calcResult.weeksLeft}</div>
                        <div className="text-xs text-gray-500">недель</div>
                      </div>
                      <div className="bg-white rounded-lg p-2">
                        <div className="text-lg font-bold text-gray-800">{calcResult.hoursPerWeek}</div>
                        <div className="text-xs text-gray-500">м/ч в нед.</div>
                      </div>
                    </div>
                    <p className="text-xs text-blue-500 text-center mt-2">
                      При режиме {hoursPerDay}ч/день × {daysPerWeek}дн/нед = {calcResult.hoursPerWeek} м/ч в неделю
                    </p>
                  </div>
                )}

                {remaining !== null && remaining <= 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center text-sm text-red-700">
                    ⚠️ ТО уже просрочено! Требуется срочное обслуживание.
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-500 mb-1">Причина изменения</label>
            <select value={reason} onChange={e => setReason(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Обычное обновление</option>
              <option value="Оборудование стояло на консервации">Оборудование стояло на консервации</option>
              <option value="Корректировка данных">Корректировка данных</option>
              <option value="Счётчик был сброшен">Счётчик был сброшен</option>
              <option value="Ошибка ввода">Исправление ошибки ввода</option>
              <option value="Другое">Другое</option>
            </select>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg text-center">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={save} disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Сохранение...' : '💾 Сохранить'}
            </button>
            <button onClick={() => { setEditing(false); setHours(String(currentHours)); setError('') }}
              className="flex-1 border py-2 rounded-lg text-sm hover:bg-gray-50">
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="text-xs text-gray-500 mb-1">Текущие</div>
              <div className="text-2xl font-bold text-gray-900">{currentHours}</div>
              <div className="text-xs text-gray-400">м/ч</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="text-xs text-gray-500 mb-1">След. ТО</div>
              <div className="text-2xl font-bold text-gray-900">{nextServiceHours || '—'}</div>
              <div className="text-xs text-gray-400">м/ч</div>
            </div>
            <div className={`rounded-xl p-3 text-center border ${status?.color || 'bg-gray-50'}`}>
              <div className="text-xs mb-1 opacity-75">Остаток</div>
              <div className="text-2xl font-bold">
                {remaining !== null ? Math.abs(remaining) : '—'}
              </div>
              <div className="text-xs opacity-75">
                {remaining !== null && remaining < 0 ? 'просрочено' : 'м/ч'}
              </div>
            </div>
          </div>

          {status && (
            <div className={`border rounded-lg px-3 py-2 text-sm text-center font-medium ${status.color}`}>
              {status.label}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

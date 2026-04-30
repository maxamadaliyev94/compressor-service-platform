'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import BrandSelect from './BrandSelect'
import EquipmentTypeSelect from './EquipmentTypeSelect'

export default function NewEquipmentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [showNewBranch, setShowNewBranch] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [newBranchAddress, setNewBranchAddress] = useState('')
  const [creatingBranch, setCreatingBranch] = useState(false)
  const [form, setForm] = useState({
    type: '', brand: '', model: '',
    serialNumber: '', yearOfManufacture: '',
    installDate: '', warrantyUntil: '', currentHours: '0',
  })

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(setClients)
  }, [])

  useEffect(() => {
    if (!selectedClient) { setBranches([]); setSelectedBranch(''); return }
    fetch(`/api/branches?clientId=${selectedClient}`)
      .then(r => r.json())
      .then(data => {
        setBranches(data)
        setSelectedBranch('')
        setShowNewBranch(data.length === 0)
      })
  }, [selectedClient])

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function createBranch() {
    if (!newBranchName.trim()) return
    setCreatingBranch(true)
    const res = await fetch('/api/branches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: selectedClient,
        name: newBranchName,
        address: newBranchAddress,
      })
    })
    const branch = await res.json()
    setBranches(prev => [...prev, branch])
    setSelectedBranch(branch.id)
    setShowNewBranch(false)
    setNewBranchName('')
    setNewBranchAddress('')
    setCreatingBranch(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedClient) { alert('Выберите клиента'); return }
    if (!selectedBranch) { alert('Выберите или создайте площадку'); return }
    setLoading(true)

    const objectsRes = await fetch(`/api/objects?branchId=${selectedBranch}`)
    const objects = await objectsRes.json()
    let objectId = objects[0]?.id

    if (!objectId) {
      const branch = branches.find(b => b.id === selectedBranch)
      const objRes = await fetch('/api/objects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: selectedBranch,
          name: branch?.name || 'Основной цех',
        })
      })
      const obj = await objRes.json()
      objectId = obj.id
    }

    const res = await fetch('/api/equipment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        objectId,
        ...form,
        yearOfManufacture: form.yearOfManufacture ? parseInt(form.yearOfManufacture) : null,
        currentHours: parseInt(form.currentHours) || 0,
        installDate: form.installDate || null,
        warrantyUntil: form.warrantyUntil || null,
      })
    })
    if (res.ok) { router.push('/equipment'); router.refresh() }
    setLoading(false)
  }

  const selectedClientData = clients.find(c => c.id === selectedClient)

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <a href="/equipment" className="text-gray-400 hover:text-gray-600">← Назад</a>
        <h1 className="text-2xl font-bold">Новое оборудование</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        <div className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold mb-4 text-gray-800">Привязка к клиенту</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Клиент *</label>
              <select required value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Выберите клиента</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name} {c.city ? `(${c.city})` : ''}</option>
                ))}
              </select>
            </div>

            {selectedClient && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium">Площадка / адрес *</label>
                  <button type="button" onClick={() => setShowNewBranch(!showNewBranch)}
                    className="text-xs text-blue-600 hover:underline">
                    {showNewBranch ? '← Выбрать существующую' : '+ Новая площадка'}
                  </button>
                </div>

                {!showNewBranch ? (
                  branches.length > 0 ? (
                    <select required value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Выберите площадку</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name} {b.address ? `— ${b.address}` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
                      У клиента нет площадок. Создайте новую ↓
                    </div>
                  )
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                    <p className="text-sm font-medium text-blue-800">Новая площадка для {selectedClientData?.name}</p>
                    <input value={newBranchName} onChange={e => setNewBranchName(e.target.value)}
                      placeholder="Название площадки (Производство, Склад №2...)"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"/>
                    <input value={newBranchAddress} onChange={e => setNewBranchAddress(e.target.value)}
                      placeholder="Адрес (необязательно)"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"/>
                    <button type="button" onClick={createBranch}
                      disabled={!newBranchName.trim() || creatingBranch}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                      {creatingBranch ? 'Создание...' : '✓ Создать площадку'}
                    </button>
                  </div>
                )}

                {selectedBranch && !showNewBranch && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ Площадка выбрана
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold mb-4 text-gray-800">Данные оборудования</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Тип *</label>
                <EquipmentTypeSelect value={form.type} onChange={val => set('type', val)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Бренд *</label>
                <BrandSelect value={form.brand} onChange={val => set('brand', val)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Модель *</label>
                <input required value={form.model} onChange={e => set('model', e.target.value)}
                  placeholder="AF-7.5, COMPAKT 7..."
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Серийный номер *</label>
                <input required value={form.serialNumber} onChange={e => set('serialNumber', e.target.value)}
                  placeholder="AF2024-001234"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Год выпуска</label>
                <input type="number" value={form.yearOfManufacture} onChange={e => set('yearOfManufacture', e.target.value)}
                  placeholder="2024" min="2000" max="2030"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Дата установки</label>
                <input type="date" value={form.installDate} onChange={e => set('installDate', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Гарантия до</label>
                <input type="date" value={form.warrantyUntil} onChange={e => set('warrantyUntil', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Текущие моточасы</label>
              <input type="number" value={form.currentHours} onChange={e => set('currentHours', e.target.value)}
                min="0" placeholder="0"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              <p className="text-xs text-gray-400 mt-1">
                Следующее ТО будет автоматически установлено через 2000 м/ч
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Сохранение...' : '+ Добавить оборудование'}
          </button>
          <a href="/equipment" className="px-6 py-2.5 rounded-lg text-sm border hover:bg-gray-50">
            Отмена
          </a>
        </div>
      </form>
    </div>
  )
}

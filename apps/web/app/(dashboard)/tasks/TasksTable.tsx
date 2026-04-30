'use client'

type TaskRow = {
  id: string
  type: string
  priority: string
  status: string
  scheduledAt: Date | null
  equipment: {
    brand: string
    model: string
    serialNumber: string
    object: { branch: { client: { name: string } } }
  }
  assignedTo: { name: string } | null
}

export default function TasksTable({
  tasks,
  typeLabels,
  statusColors,
  statusLabels,
  priorityColors,
}: {
  tasks: TaskRow[]
  typeLabels: Record<string, string>
  statusColors: Record<string, string>
  statusLabels: Record<string, string>
  priorityColors: Record<string, string>
}) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 border-b">
        <tr>
          <th className="text-left p-3 font-medium">Тип</th>
          <th className="text-left p-3 font-medium">Оборудование</th>
          <th className="text-left p-3 font-medium">Клиент</th>
          <th className="text-left p-3 font-medium">Инженер</th>
          <th className="text-left p-3 font-medium">Срок</th>
          <th className="text-left p-3 font-medium">Статус</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => (
          <tr
            key={task.id}
            className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
            onClick={() => window.location.href = `/tasks/${task.id}`}
          >
            <td className="p-3">
              <span className={`font-medium ${priorityColors[task.priority]}`}>●</span> {typeLabels[task.type] || task.type}
            </td>
            <td className="p-3">
              <div>
                {task.equipment.brand} {task.equipment.model}
              </div>
              <div className="text-xs text-gray-500">{task.equipment.serialNumber}</div>
            </td>
            <td className="p-3 text-gray-600">{task.equipment.object.branch.client.name}</td>
            <td className="p-3 text-gray-600">{task.assignedTo?.name || <span className="text-gray-400">Не назначен</span>}</td>
            <td className="p-3 text-gray-600">{task.scheduledAt ? new Date(task.scheduledAt).toLocaleDateString('ru-RU') : '—'}</td>
            <td className="p-3">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[task.status]}`}>{statusLabels[task.status]}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

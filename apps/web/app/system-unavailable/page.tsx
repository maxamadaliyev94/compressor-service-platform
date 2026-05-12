export default function SystemUnavailablePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">Подписка истекла</h1>
        <p className="text-sm text-gray-600">
          Ваша подписка закончилась. Для продолжения работы свяжитесь с поставщиком для оформления подписки.
        </p>
      </div>
    </div>
  )
}

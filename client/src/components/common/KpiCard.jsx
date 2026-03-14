import clsx from 'clsx'

export default function KpiCard({
  title, value, subValue, icon: Icon, colorClass = 'border-blue-500',
  onClick, loading = false,
}) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-white rounded-xl shadow-sm p-5 cursor-pointer',
        'hover:shadow-md hover:-translate-y-0.5 transition-all duration-200',
        'border-l-4',
        colorClass,
        'animate-fade-in'
      )}
    >
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-500 font-medium">{title}</span>
        {Icon && (
          <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center">
            <Icon className="w-5 h-5 text-gray-400" />
          </div>
        )}
      </div>
      {loading ? (
        <div className="mt-3 space-y-2">
          <div className="h-8 w-20 bg-gray-100 rounded animate-pulse" />
          <div className="h-3 w-32 bg-gray-50 rounded animate-pulse" />
        </div>
      ) : (
        <>
          <p className="text-3xl font-bold mt-2 text-gray-900">{value ?? '--'}</p>
          {subValue && (
            <p className="text-xs text-gray-400 mt-1">{subValue}</p>
          )}
        </>
      )}
    </div>
  )
}

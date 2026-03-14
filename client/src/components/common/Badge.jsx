import clsx from 'clsx'
import { statusBg } from '../../utils/statusColor'

export default function Badge({ status }) {
  const label = status?.charAt(0).toUpperCase() + status?.slice(1)
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium',
        statusBg[status] || 'bg-gray-100 text-gray-600'
      )}
    >
      {label}
    </span>
  )
}

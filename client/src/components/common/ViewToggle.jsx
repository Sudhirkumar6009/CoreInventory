import clsx from 'clsx'
import { ListBulletIcon, Squares2X2Icon } from '@heroicons/react/24/outline'

export default function ViewToggle({ mode = 'list', onChange }) {
  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
      <button
        onClick={() => onChange('list')}
        className={clsx(
          'p-2 rounded-md transition-all duration-200',
          mode === 'list'
            ? 'bg-white shadow-sm text-brand-accent'
            : 'text-gray-400 hover:text-gray-600'
        )}
        title="List View"
      >
        <ListBulletIcon className="w-4 h-4" />
      </button>
      <button
        onClick={() => onChange('kanban')}
        className={clsx(
          'p-2 rounded-md transition-all duration-200',
          mode === 'kanban'
            ? 'bg-white shadow-sm text-brand-accent'
            : 'text-gray-400 hover:text-gray-600'
        )}
        title="Kanban View"
      >
        <Squares2X2Icon className="w-4 h-4" />
      </button>
    </div>
  )
}

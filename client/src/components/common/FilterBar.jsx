import { useNavigate } from 'react-router-dom'
import { PlusIcon, FunnelIcon, Squares2X2Icon } from '@heroicons/react/24/outline'
import Button from './Button'
import SearchBar from './SearchBar'
import ViewToggle from './ViewToggle'
import { STATUS_OPTIONS } from '../../constants'

export default function FilterBar({
  module,
  newPath,
  onSearch,
  statusFilter,
  onStatusChange,
  viewMode = 'list',
  onViewChange,
  hideNew = false,
  extraFilters,
}) {
  const navigate = useNavigate()

  return (
    <div className="flex flex-wrap items-center gap-3 mb-5">
      {!hideNew && newPath && (
        <Button onClick={() => navigate(newPath)} size="md">
          <PlusIcon className="w-4 h-4" />
          New
        </Button>
      )}

      <SearchBar
        onSearch={onSearch}
        placeholder={`Search ${module}...`}
        className="flex-1 min-w-[200px] max-w-sm"
      />

      <div className="flex items-center gap-2 ml-auto">
        {onStatusChange && (
          <div className="relative">
            <select
              value={statusFilter || ''}
              onChange={(e) => onStatusChange(e.target.value)}
              className="input-field pl-8 pr-4 py-2 text-sm min-w-[140px]"
            >
              <option value="">All Status</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
            <FunnelIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
        )}

        {extraFilters}

        {onViewChange && (
          <ViewToggle mode={viewMode} onChange={onViewChange} />
        )}
      </div>
    </div>
  )
}

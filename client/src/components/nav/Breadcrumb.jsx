import { Link, useLocation } from 'react-router-dom'
import { ChevronRightIcon, HomeIcon } from '@heroicons/react/24/outline'

const labelMap = {
  dashboard: 'Dashboard',
  operations: 'Operations',
  receipts: 'Receipts',
  deliveries: 'Deliveries',
  transfers: 'Internal Transfers',
  adjustments: 'Adjustments',
  moves: 'Move History',
  products: 'Products',
  categories: 'Categories',
  'reorder-rules': 'Reorder Rules',
  settings: 'Settings',
  warehouses: 'Warehouses',
  locations: 'Locations',
  new: 'New',
  edit: 'Edit',
}

export default function Breadcrumb() {
  const location = useLocation()
  const segments = location.pathname.split('/').filter(Boolean)

  if (segments.length === 0) return null

  return (
    <nav className="flex items-center gap-1.5 text-sm mb-5">
      <Link
        to="/dashboard"
        className="text-gray-400 hover:text-brand-accent transition-colors"
      >
        <HomeIcon className="w-4 h-4" />
      </Link>
      {segments.map((seg, i) => {
        const path = '/' + segments.slice(0, i + 1).join('/')
        const isLast = i === segments.length - 1
        const label = labelMap[seg] || seg.charAt(0).toUpperCase() + seg.slice(1)

        return (
          <span key={path} className="flex items-center gap-1.5">
            <ChevronRightIcon className="w-3.5 h-3.5 text-gray-300" />
            {isLast ? (
              <span className="text-gray-700 font-medium">{label}</span>
            ) : (
              <Link
                to={path}
                className="text-gray-400 hover:text-brand-accent transition-colors"
              >
                {label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}

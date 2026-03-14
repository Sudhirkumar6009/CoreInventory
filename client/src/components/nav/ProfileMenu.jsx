import { useNavigate, useLocation } from 'react-router-dom'
import {
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  HomeIcon,
  CubeIcon,
  TruckIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  ArrowsRightLeftIcon,
  AdjustmentsHorizontalIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { useAuthStore } from '../../store/authStore'
import { useRole } from '../../hooks/useRole'
import clsx from 'clsx'

// All sidebar items with their role restrictions
const ALL_MENU_ITEMS = [
  { label: 'Dashboard', icon: HomeIcon, path: '/dashboard' },
  // Manager-only
  { label: 'Products', icon: CubeIcon, path: '/products', roles: ['manager'] },
  { label: 'Receipts', icon: ClipboardDocumentListIcon, path: '/operations/receipts', roles: ['manager'] },
  { label: 'Deliveries', icon: TruckIcon, path: '/operations/deliveries', roles: ['manager'] },
  // Both roles
  { label: 'Transfers', icon: ArrowsRightLeftIcon, path: '/operations/transfers' },
  { label: 'Adjustments', icon: AdjustmentsHorizontalIcon, path: '/operations/adjustments' },
  { label: 'Move History', icon: ClockIcon, path: '/operations/moves' },
  // Manager-only
  { label: 'Settings', icon: Cog6ToothIcon, path: '/settings/warehouses', roles: ['manager'] },
]

export default function ProfileMenu() {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const { role, isManager } = useRole()

  // Filter items by role
  const menuItems = ALL_MENU_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(role)
  )

  return (
    <div className="flex flex-col h-full">
      {/* User profile section */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-brand-accent to-rose-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm">
            {(user?.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{user?.name || 'User'}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email || ''}</p>
          </div>
        </div>
        {/* Role badge */}
        <div className="mt-3">
          <span className={clsx(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold w-full justify-center',
            isManager
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-blue-50 text-blue-700 border border-blue-200'
          )}>
            <span>{isManager ? '🏷' : '📦'}</span>
            {isManager ? 'Inventory Manager' : 'Warehouse Staff'}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 p-3 space-y-0.5">
        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={clsx(
              'sidebar-item w-full',
              location.pathname.startsWith(item.path) && 'active'
            )}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {item.label}
          </button>
        ))}
      </div>

      {/* Logout */}
      <div className="p-3 border-t border-gray-100">
        <button
          onClick={() => {
            logout()
            navigate('/login')
          }}
          className="sidebar-item w-full text-red-500 hover:bg-red-50 hover:text-red-600"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5 flex-shrink-0" />
          Logout
        </button>
      </div>
    </div>
  )
}

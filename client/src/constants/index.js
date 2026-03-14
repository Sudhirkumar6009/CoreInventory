export const STATUS_OPTIONS = ['draft', 'waiting', 'ready', 'done', 'cancelled']
export const MOVE_TYPES = ['IN', 'OUT', 'INTERNAL', 'ADJUSTMENT']
export const UOM_OPTIONS = ['kg', 'units', 'liters', 'meters', 'boxes', 'packs']

export const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard' },
  {
    label: 'Operations',
    children: [
      { label: 'Receipts', path: '/operations/receipts' },
      { label: 'Deliveries', path: '/operations/deliveries' },
      { label: 'Internal Transfers', path: '/operations/transfers' },
      { label: 'Adjustments', path: '/operations/adjustments' },
    ],
  },
  {
    label: 'Products',
    children: [
      { label: 'All Products', path: '/products' },
      { label: 'Categories', path: '/products/categories' },
      { label: 'Reorder Rules', path: '/products/reorder-rules' },
    ],
  },
  { label: 'Move History', path: '/operations/moves' },
  {
    label: 'Settings',
    children: [
      { label: 'Warehouses', path: '/settings/warehouses' },
      { label: 'Locations', path: '/settings/locations' },
    ],
  },
]

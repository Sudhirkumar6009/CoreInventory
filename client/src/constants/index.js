export const STATUS_OPTIONS = ['draft', 'waiting', 'ready', 'done', 'cancelled']
export const MOVE_TYPES = ['IN', 'OUT', 'INTERNAL', 'ADJUSTMENT']
export const UOM_OPTIONS = ['kg', 'units', 'liters', 'meters', 'boxes', 'packs']

export const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard' },
  {
    label: 'Operations',
    children: [
      // Manager: manage incoming & outgoing stock
      { label: 'Receipts', path: '/operations/receipts', roles: ['manager'] },
      { label: 'Deliveries', path: '/operations/deliveries', roles: ['manager'] },
      // Both: stock counting & adjustments
      { label: 'Internal Transfers', path: '/operations/transfers' },
      { label: 'Adjustments', path: '/operations/adjustments' },
    ],
  },
  {
    // Manager only: product catalogue + reorder rules
    label: 'Products',
    roles: ['manager'],
    children: [
      { label: 'All Products', path: '/products' },
      { label: 'Categories', path: '/products/categories' },
      { label: 'Reorder Rules', path: '/products/reorder-rules' },
    ],
  },
  { label: 'Move History', path: '/operations/moves' },
  {
    // Manager only: warehouse & location configuration
    label: 'Settings',
    roles: ['manager'],
    children: [
      { label: 'Warehouses', path: '/settings/warehouses' },
      { label: 'Locations', path: '/settings/locations' },
    ],
  },
]

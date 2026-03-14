import { create } from 'zustand'

export const useFilterStore = create((set) => ({
  receipts:    { status: '', search: '', page: 1 },
  deliveries:  { status: '', search: '', page: 1 },
  transfers:   { status: '', search: '', page: 1 },
  adjustments: { status: '', search: '', page: 1 },
  moves:       { type: '', dateRange: null, search: '', page: 1 },
  products:    { search: '', category: '', page: 1 },
  setFilter: (module, patch) =>
    set((s) => ({ [module]: { ...s[module], ...patch } })),
}))

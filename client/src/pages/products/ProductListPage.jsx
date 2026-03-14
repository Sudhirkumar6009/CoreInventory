import { useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { productService } from '../../api/productService'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import FilterBar from '../../components/common/FilterBar'
import Table from '../../components/common/Table'
import Pagination from '../../components/common/Pagination'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

export default function ProductListPage() {
  useDocumentTitle('Products')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState({ search: '', page: 1 })

  const { data, isLoading } = useQuery({
    queryKey: ['products', filters],
    queryFn: () => productService.getAll({ ...filters, limit: 20 }).then((r) => {
      const payload = r.data || {}
      return {
        items: payload.data || payload.products || payload.items || [],
        totalPages: payload.pagination?.pages || payload.totalPages || 1,
      }
    }),
    placeholderData: keepPreviousData,
  })

  const columns = [
    { key: 'name', label: 'Product Name', render: (r) => <span className="font-medium text-gray-900">{r.name}</span> },
    { key: 'sku', label: 'SKU', render: (r) => <span className="text-xs font-mono text-gray-500">{r.sku || r.code || '--'}</span> },
    { key: 'perUnitCost', label: 'Per Unit Cost', render: (r) => r.perUnitCost != null ? `₹${r.perUnitCost}` : '--' },
    {
      key: 'onHand', label: 'On Hand',
      render: (r) => {
        const onHand = r.onHand ?? r.stock ?? 0
        const isLow = onHand <= (r.reorderPoint || 0) && onHand > 0
        const isOut = onHand === 0
        return (
          <div className="flex items-center gap-1.5">
            <span className={clsx(isOut && 'text-red-600 font-semibold', isLow && 'text-amber-600 font-semibold')}>
              {onHand}
            </span>
            {(isLow || isOut) && <ExclamationTriangleIcon className={clsx('w-4 h-4', isOut ? 'text-red-500' : 'text-amber-500')} />}
          </div>
        )
      },
    },
    {
      key: 'freeToUse', label: 'Free To Use',
      render: (r) => {
        const free = (r.onHand ?? r.stock ?? 0) - (r.reservedQty || 0)
        return <span className={clsx(free <= 0 && 'text-red-500 font-semibold')}>{free}</span>
      },
    },
  ]

  const handleSearch = useCallback((search) => { setFilters((f) => ({ ...f, search, page: 1 })) }, [])
  const items = data?.items || []

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Products</h1>
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 mb-5 text-sm text-blue-700">
        Stock quantities update automatically via Receipts, Deliveries, Transfers, and Adjustments.
      </div>
      <FilterBar module="products" newPath="/products/new" onSearch={handleSearch} />
      <Table columns={columns} data={items} loading={isLoading} emptyMessage="No products found."
        onRowClick={(row) => navigate(`/products/${row._id || row.id}/edit`)} />
      <Pagination page={filters.page} totalPages={data?.totalPages || 1} onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))} />
    </div>
  )
}

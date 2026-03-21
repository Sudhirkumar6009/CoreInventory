import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { productService } from '../../api/productService'
import { warehouseService } from '../../api/warehouseService'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useRole } from '../../hooks/useRole'
import FilterBar from '../../components/common/FilterBar'
import Table from '../../components/common/Table'
import Pagination from '../../components/common/Pagination'

export default function ProductListPage() {
  useDocumentTitle('Products')
  const navigate = useNavigate()
  const { isManager } = useRole()
  const [filters, setFilters] = useState({ search: '', page: 1, locationId: '' })

  const { data: locationsData } = useQuery({
    queryKey: ["locations"],
    queryFn: () => warehouseService.getLocations().then(r => r.data?.data || r.data?.locations || []),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["products", filters],
    queryFn: () =>
      productService.getAll({ ...filters, limit: 20 }).then((r) => {
        const payload = r.data || {};
        return {
          items: payload.data || payload.products || payload.items || [],
          totalPages: payload.pagination?.pages || payload.totalPages || 1,
        };
      }),
    placeholderData: keepPreviousData,
  });

  const columns = [
    { key: 'name', label: 'Product Name', render: (r) => <span className="font-medium text-gray-900">{r.name}</span> },
    { key: 'sku', label: 'SKU', render: (r) => <span className="text-xs font-mono text-gray-500">{r.sku || r.code || '--'}</span> },
    { key: 'perUnitCost', label: 'Per Unit Cost', render: (r) => r.perUnitCost != null ? `₹${r.perUnitCost}` : '--' },
    { key: 'onHand', label: 'On Hand', render: (r) => r.onHand ?? 0 },
    { key: 'freeToUse', label: 'Free To Use', render: (r) => r.freeToUse ?? ((r.onHand || 0) - (r.reservedQty || 0)) },
  ]

  const handleSearch = useCallback((search) => {
    setFilters((f) => ({ ...f, search, page: 1 }));
  }, []);

  const handleLocationChange = useCallback((e) => {
    setFilters((f) => ({ ...f, locationId: e.target.value, page: 1 }));
  }, []);
  const items = data?.items || [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Products</h1>
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 mb-5 text-sm text-blue-700">
        Stock quantities update automatically via Receipts, Deliveries,
        Transfers, and Adjustments.
      </div>
      <div className="flex items-center justify-end mb-4">
        <select
          value={filters.locationId}
          onChange={handleLocationChange}
          className="input-field w-auto min-w-[200px] bg-white text-sm"
        >
          <option value="">Total (All Locations)</option>
          {(locationsData || []).map((loc) => (
            <option key={loc._id || loc.id} value={loc._id || loc.id}>
              {loc.name} {loc.shortCode ? `(${loc.shortCode})` : ''}
            </option>
          ))}
        </select>
      </div>
      <FilterBar
        module="products"
        newPath="/products/new"
        hideNew={!isManager}
        onSearch={handleSearch}
      />
      <Table
        columns={columns}
        data={items}
        loading={isLoading}
        emptyMessage="No products found."
        onRowClick={(row) => navigate(`/products/${row._id || row.id}/edit`)}
      />
      <Pagination
        page={filters.page}
        totalPages={data?.totalPages || 1}
        onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
      />
    </div>
  );
}

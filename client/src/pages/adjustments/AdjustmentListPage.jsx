import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { adjustmentService } from '../../api/adjustmentService'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import FilterBar from '../../components/common/FilterBar'
import Table from '../../components/common/Table'
import Pagination from '../../components/common/Pagination'
import { formatDate } from '../../utils/formatDate'

export default function AdjustmentListPage() {
  useDocumentTitle('Adjustments')
  const navigate = useNavigate()
  const [filters, setFilters] = useState({ search: '', page: 1 })

  const { data, isLoading } = useQuery({
    queryKey: ['adjustments', filters],
    queryFn: () => adjustmentService.getAll({ ...filters, limit: 20 }).then((r) => {
      const payload = r.data || {}
      return {
        items: payload.data || payload.adjustments || payload.items || [],
        totalPages: payload.pagination?.pages || payload.totalPages || 1,
      }
    }),
    placeholderData: keepPreviousData,
  })

  const columns = [
    { key: 'reference', label: 'Reference', render: (r) => <span className="font-medium text-gray-900">{r.reference}</span> },
    { key: 'date', label: 'Date', render: (r) => formatDate(r.adjustmentDate || r.date || r.createdAt) },
    { key: 'location', label: 'Location', render: (r) => r.locationId?.name || r.location?.name || '--' },
    { key: 'lines', label: 'Lines', render: (r) => r.lines?.length || 0 },
  ]

  const handleSearch = useCallback((search) => { setFilters((f) => ({ ...f, search, page: 1 })) }, [])
  const items = data?.items || []

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-5">Inventory Adjustments</h1>
      <FilterBar module="adjustments" newPath="/operations/adjustments/new" onSearch={handleSearch} />
      <Table columns={columns} data={items} loading={isLoading} emptyMessage="No adjustments found."
        onRowClick={(row) => navigate(`/operations/adjustments/${row._id || row.id}`)} />
      <Pagination page={filters.page} totalPages={data?.totalPages || 1} onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))} />
    </div>
  )
}

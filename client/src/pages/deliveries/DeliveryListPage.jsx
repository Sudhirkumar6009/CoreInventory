import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { deliveryService } from '../../api/deliveryService'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useRole } from '../../hooks/useRole'
import FilterBar from '../../components/common/FilterBar'
import Table from '../../components/common/Table'
import Pagination from '../../components/common/Pagination'
import Badge from '../../components/common/Badge'
import { formatDate } from '../../utils/formatDate'

export default function DeliveryListPage() {
  useDocumentTitle('Deliveries')
  const navigate = useNavigate()
  const { isManager } = useRole()
  const [filters, setFilters] = useState({ status: '', search: '', page: 1 })
  const [viewMode, setViewMode] = useState('list')

  const { data, isLoading } = useQuery({
    queryKey: ['deliveries', filters],
    queryFn: () => deliveryService.getAll({ ...filters, limit: 20 }).then((r) => {
      const payload = r.data || {}
      return {
        items: payload.data || payload.deliveries || payload.items || [],
        totalPages: payload.pagination?.pages || payload.totalPages || 1,
      }
    }),
    placeholderData: keepPreviousData,
  })

  const columns = [
    { key: 'date', label: 'Date', render: (r) => formatDate(r.scheduledDate || r.date || r.createdAt) },
    { key: 'reference', label: 'Reference', render: (r) => <span className="font-medium text-gray-900">{r.reference}</span> },
    { key: 'scheduledDate', label: 'Scheduled Date', render: (r) => formatDate(r.scheduledDate) },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
  ]

  const handleSearch = useCallback((search) => {
    setFilters((f) => ({ ...f, search, page: 1 }))
  }, [])

  const items = data?.items || []
  const totalPages = data?.totalPages || 1

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-5">Deliveries</h1>
      <FilterBar
        module="deliveries"
        newPath="/operations/deliveries/new"
        hideNew={!isManager}
        onSearch={handleSearch}
        statusFilter={filters.status}
        onStatusChange={(s) => setFilters((f) => ({ ...f, status: s, page: 1 }))}
        viewMode={viewMode}
        onViewChange={setViewMode}
      />
      <Table
        columns={columns}
        data={items}
        loading={isLoading}
        emptyMessage="No deliveries found."
        onRowClick={(row) => navigate(`/operations/deliveries/${row._id || row.id}`)}
      />
      <Pagination page={filters.page} totalPages={totalPages} onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))} />
    </div>
  )
}

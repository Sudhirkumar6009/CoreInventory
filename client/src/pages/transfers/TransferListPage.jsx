import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { transferService } from '../../api/transferService'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import FilterBar from '../../components/common/FilterBar'
import Table from '../../components/common/Table'
import Pagination from '../../components/common/Pagination'
import Badge from '../../components/common/Badge'
import { formatDate } from '../../utils/formatDate'

export default function TransferListPage() {
  useDocumentTitle('Internal Transfers')
  const navigate = useNavigate()
  const [filters, setFilters] = useState({ status: '', search: '', page: 1 })

  const { data, isLoading } = useQuery({
    queryKey: ['transfers', filters],
    queryFn: () => transferService.getAll({ ...filters, limit: 20 }).then((r) => r.data),
    placeholderData: keepPreviousData,
  })

  const columns = [
    { key: 'reference', label: 'Reference', render: (r) => <span className="font-medium text-gray-900">{r.reference}</span> },
    { key: 'sourceLocation', label: 'From', render: (r) => r.sourceLocation?.name || r.sourceLocation || '--' },
    { key: 'destinationLocation', label: 'To', render: (r) => r.destinationLocation?.name || r.destinationLocation || '--' },
    { key: 'scheduledDate', label: 'Scheduled Date', render: (r) => formatDate(r.scheduledDate) },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
  ]

  const handleSearch = useCallback((search) => { setFilters((f) => ({ ...f, search, page: 1 })) }, [])
  const items = data?.transfers || data?.items || []

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-5">Internal Transfers</h1>
      <FilterBar module="transfers" newPath="/operations/transfers/new" onSearch={handleSearch}
        statusFilter={filters.status} onStatusChange={(s) => setFilters((f) => ({ ...f, status: s, page: 1 }))} />
      <Table columns={columns} data={items} loading={isLoading} emptyMessage="No transfers found."
        onRowClick={(row) => navigate(`/operations/transfers/${row._id || row.id}`)} />
      <Pagination page={filters.page} totalPages={data?.totalPages || 1} onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))} />
    </div>
  )
}

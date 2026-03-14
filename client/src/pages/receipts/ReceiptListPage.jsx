import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { receiptService } from '../../api/receiptService'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useRole } from '../../hooks/useRole'
import FilterBar from '../../components/common/FilterBar'
import Table from '../../components/common/Table'
import Pagination from '../../components/common/Pagination'
import Badge from '../../components/common/Badge'
import { formatDate } from '../../utils/formatDate'
import clsx from 'clsx'

export default function ReceiptListPage() {
  useDocumentTitle('Receipts')
  const navigate = useNavigate()
  const { isManager } = useRole()
  const [filters, setFilters] = useState({ status: '', search: '', page: 1 })
  const [viewMode, setViewMode] = useState('list')

  const { data, isLoading } = useQuery({
    queryKey: ['receipts', filters],
    queryFn: () => receiptService.getAll({ ...filters, limit: 20 }).then((r) => {
      const payload = r.data || {}
      return {
        items: payload.data || payload.receipts || payload.items || [],
        totalPages: payload.pagination?.pages || payload.totalPages || 1,
      }
    }),
    placeholderData: keepPreviousData,
  })

  const columns = [
    { key: 'date', label: 'Date', render: (r) => formatDate(r.scheduledDate || r.date || r.createdAt) },
    { key: 'reference', label: 'Reference', render: (r) => <span className="font-medium text-gray-900">{r.reference}</span> },
    { key: 'supplier', label: 'Supplier', render: (r) => r.supplier || r.supplierOrCustomer || '--' },
    { key: 'scheduledDate', label: 'Scheduled Date', render: (r) => formatDate(r.scheduledDate) },
    { key: 'sourceDocument', label: 'Source Doc', render: (r) => r.sourceDocument || '--' },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
  ]

  const handleSearch = useCallback((search) => {
    setFilters((f) => ({ ...f, search, page: 1 }))
  }, [])

  const items = data?.items || []
  const totalPages = data?.totalPages || 1

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-5">Receipts</h1>

      <FilterBar
        module="receipts"
        newPath="/operations/receipts/new"
        hideNew={!isManager}
        onSearch={handleSearch}
        statusFilter={filters.status}
        onStatusChange={(s) => setFilters((f) => ({ ...f, status: s, page: 1 }))}
        viewMode={viewMode}
        onViewChange={setViewMode}
      />

      {viewMode === 'list' ? (
        <>
          <Table
            columns={columns}
            data={items}
            loading={isLoading}
            emptyMessage="No receipts found."
            onRowClick={(row) => navigate(`/operations/receipts/${row._id || row.id}`)}
          />
          <Pagination page={filters.page} totalPages={totalPages} onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))} />
        </>
      ) : (
        <KanbanView items={items} onCardClick={(r) => navigate(`/operations/receipts/${r._id || r.id}`)} />
      )}
    </div>
  )
}

function KanbanView({ items, onCardClick }) {
  const statuses = ['draft', 'waiting', 'ready', 'done', 'cancelled']
  return (
    <div className="grid grid-cols-5 gap-4">
      {statuses.map((status) => (
        <div key={status} className="bg-gray-50 rounded-xl p-3 min-h-[200px]">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3 px-1">
            {status} ({items.filter((i) => i.status === status).length})
          </h3>
          <div className="space-y-2">
            {items.filter((i) => i.status === status).map((item) => (
              <div
                key={item._id || item.id}
                onClick={() => onCardClick(item)}
                className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all"
              >
                <p className="text-sm font-medium text-gray-900">{item.reference}</p>
                <p className="text-xs text-gray-500 mt-1">{item.supplier || item.customer || item.supplierOrCustomer || '--'}</p>
                <p className="text-xs text-gray-400 mt-1">{formatDate(item.scheduledDate)}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

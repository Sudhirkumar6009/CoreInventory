import { useState, useCallback } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { moveService } from '../../api/moveService'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import FilterBar from '../../components/common/FilterBar'
import Table from '../../components/common/Table'
import Pagination from '../../components/common/Pagination'
import Badge from '../../components/common/Badge'
import Modal from '../../components/common/Modal'
import { formatDate, formatDateTime } from '../../utils/formatDate'
import { MOVE_TYPES } from '../../constants'

export default function MoveHistoryPage() {
  useDocumentTitle('Move History')
  const [filters, setFilters] = useState({ type: '', search: '', status: 'done', page: 1 })
  const [selectedMove, setSelectedMove] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['moves', filters],
    queryFn: () => moveService.getAll({ ...filters, limit: 20 }).then((r) => {
      const payload = r.data || {}
      return {
        items: payload.data || payload.moves || payload.items || [],
        totalPages: payload.pagination?.pages || payload.totalPages || 1,
      }
    }),
    placeholderData: keepPreviousData,
  })

  const columns = [
    { key: 'date', label: 'Date', render: (r) => formatDate(r.date || r.createdAt) },
    { key: 'reference', label: 'Reference', render: (r) => <span className="font-medium text-gray-900">{r.reference}</span> },
    { key: 'product', label: 'Product', render: (r) => r.productName || r.product?.name || '--' },
    { key: 'fromLocation', label: 'From', render: (r) => r.fromDisplay || r.fromLocation?.name || r.fromLocation || '--' },
    { key: 'toLocation', label: 'To', render: (r) => r.toDisplay || r.toLocation?.name || r.toLocation || '--' },
    { key: 'quantity', label: 'Quantity', render: (r) => <span className="font-medium">{r.quantity} {r.uom || ''}</span> },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
  ]

  const handleSearch = useCallback((search) => { setFilters((f) => ({ ...f, search, page: 1 })) }, [])
  const items = data?.items || []

  const typeFilter = (
    <select value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value, page: 1 }))}
      className="input-field py-2 text-sm min-w-[130px]">
      <option value="">All Types</option>
      {MOVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
    </select>
  )

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-5">Move History</h1>
      <FilterBar module="moves" hideNew onSearch={handleSearch}
        statusFilter={filters.status} onStatusChange={(s) => setFilters((f) => ({ ...f, status: s, page: 1 }))}
        extraFilters={typeFilter} />
      <Table columns={columns} data={items} loading={isLoading} emptyMessage="No moves found."
        onRowClick={(row) => setSelectedMove(row)} />
      <Pagination page={filters.page} totalPages={data?.totalPages || 1} onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))} />

      {/* Detail Modal */}
      <Modal isOpen={!!selectedMove} onClose={() => setSelectedMove(null)} title="Move Details" size="md">
        {selectedMove && (
          <div className="space-y-3 text-sm">
            {[
              ['Reference', selectedMove.reference],
              ['Date', formatDateTime(selectedMove.date || selectedMove.createdAt)],
              ['Product', selectedMove.productName || selectedMove.product?.name],
              ['From', selectedMove.fromDisplay || selectedMove.fromLocation?.name || selectedMove.fromLocation],
              ['To', selectedMove.toDisplay || selectedMove.toLocation?.name || selectedMove.toLocation],
              ['Quantity', `${selectedMove.quantity} ${selectedMove.uom || ''}`],
              ['Move Type', selectedMove.moveType || selectedMove.type],
              ['Status', selectedMove.status],
              ['Created By', selectedMove.createdBy?.name || selectedMove.createdBy],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">{label}</span>
                <span className="font-medium text-gray-900">{value || '--'}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}

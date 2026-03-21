import { useState, useCallback } from 'react'
import clsx from 'clsx'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { moveService } from '../../api/moveService'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useRole } from '../../hooks/useRole'
import FilterBar from '../../components/common/FilterBar'
import Table from '../../components/common/Table'
import Pagination from '../../components/common/Pagination'
import Badge from '../../components/common/Badge'
import Modal from '../../components/common/Modal'
import { formatDate, formatDateTime } from '../../utils/formatDate'
import { MOVE_TYPES } from '../../constants'

export default function MoveHistoryPage() {
  useDocumentTitle('Move History')
  const { isManager } = useRole()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('done')
  const [movePage, setMovePage] = useState(1)
  const [adjPage, setAdjPage] = useState(1)
  const [selectedMove, setSelectedMove] = useState(null)
  const [moveType, setMoveType] = useState('') // Used for the movements table

  // Query 1: Inventory Movements (IN, OUT, INTERNAL)
  const movementsQuery = useQuery({
    queryKey: ['moves', 'movements', { search, status, moveType, page: movePage }],
    enabled: isManager,
    queryFn: () => {
      return moveService.getAll({ 
        search, 
        status, 
        moveType: moveType || undefined, 
        excludeType: moveType ? undefined : 'ADJUSTMENT',
        page: movePage, 
        limit: 15 
      }).then((r) => {
        const payload = r.data || {}
        return {
          items: payload.data || payload.moves || payload.items || [],
          totalPages: payload.pagination?.pages || payload.totalPages || 1,
        }
      })
    },
    placeholderData: keepPreviousData,
  })

  // Query 2: Stock Adjustments (Always status=done)
  const adjustmentsQuery = useQuery({
    queryKey: ['moves', 'adjustments', { search, page: adjPage }],
    queryFn: () => moveService.getAll({ 
      search, 
      status: 'done', // Adjustments are always done
      moveType: 'ADJUSTMENT', 
      page: adjPage, 
      limit: 15 
    }).then((r) => {
      const payload = r.data || {}
      return {
        items: payload.data || payload.moves || payload.items || [],
        totalPages: payload.pagination?.pages || payload.totalPages || 1,
      }
    }),
    placeholderData: keepPreviousData,
  })

  const commonColumns = [
    { key: 'date', label: 'Date', render: (r) => formatDate(r.date || r.createdAt) },
    { key: 'reference', label: 'Reference', render: (r) => <span className="font-medium text-gray-900">{r.reference}</span> },
    { key: 'product', label: 'Product', render: (r) => r.productName || r.product?.name || '--' },
  ]

  const moveColumns = [
    ...commonColumns,
    { key: 'fromLocation', label: 'From', render: (r) => r.fromDisplay || r.fromLocation?.name || '--' },
    { key: 'toLocation', label: 'To', render: (r) => r.toDisplay || r.toLocation?.name || '--' },
    { key: 'quantity', label: 'Quantity', render: (r) => <span className="font-medium">{r.quantity} {r.uom || ''}</span> },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
  ]

  const adjColumns = [
    ...commonColumns,
    { key: 'location', label: 'Location', render: (r) => r.fromLocation?.name || r.toLocation?.name || r.fromDisplay || '--' },
    { 
      key: 'type', 
      label: 'Type', 
      render: (r) => {
        const isPositive = r.quantity > 0
        return (
          <span className={clsx("text-xs font-semibold px-2 py-0.5 rounded-full", 
            isPositive ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700")}>
            {isPositive ? 'Inventory Plus' : 'Inventory Loss'}
          </span>
        )
      }
    },
    { key: 'quantity', label: 'Delta', render: (r) => <span className="font-medium">{Math.abs(r.quantity)} {r.uom || ''}</span> },
    { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
  ]

  const handleSearch = useCallback((s) => { 
    setSearch(s)
    setMovePage(1)
    setAdjPage(1)
  }, [])

  const movementTypeFilter = (
    <select
      value={moveType}
      onChange={(e) => { setMoveType(e.target.value); setMovePage(1) }}
      className="input-field py-2 text-sm min-w-[140px]"
    >
      <option value="">All Movements</option>
      {MOVE_TYPES.filter(t => t !== 'ADJUSTMENT').map((t) => <option key={t} value={t}>{t}</option>)}
    </select>
  )

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Move History</h1>
      </div>
      
      <FilterBar 
        module="moves" 
        hideNew 
        onSearch={handleSearch}
        statusFilter={status} 
        onStatusChange={(s) => { setStatus(s); setMovePage(1); setAdjPage(1) }}
        extraFilters={isManager ? movementTypeFilter : null} 
      />

      {isManager && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-4">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Inventory Movements</h2>
          </div>
          <Table 
            columns={moveColumns} 
            data={movementsQuery.data?.items || []} 
            loading={movementsQuery.isLoading} 
            emptyMessage="No movements found."
            onRowClick={(row) => setSelectedMove(row)} 
          />
          <div className="p-4 border-t border-gray-100">
            <Pagination 
              page={movePage} 
              totalPages={movementsQuery.data?.totalPages || 1} 
              onPageChange={setMovePage} 
            />
          </div>
        </div>
      )}


      <div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Adjustment History</h2>
          </div>
          <Table 
            columns={adjColumns} 
            data={adjustmentsQuery.data?.items || []} 
            loading={adjustmentsQuery.isLoading} 
            emptyMessage="No adjustments found."
            onRowClick={(row) => setSelectedMove(row)} 
          />
          <div className="p-4 border-t border-gray-100">
            <Pagination 
              page={adjPage} 
              totalPages={adjustmentsQuery.data?.totalPages || 1} 
              onPageChange={setAdjPage} 
            />
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal isOpen={!!selectedMove} onClose={() => setSelectedMove(null)} title="Record Details" size="md">
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
              ['Created By', selectedMove.createdBy?.name || selectedMove.createdBy?.email || '--'],
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

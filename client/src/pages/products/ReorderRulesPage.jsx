import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productService } from '../../api/productService'
import { warehouseService } from '../../api/warehouseService'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import Table from '../../components/common/Table'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

export default function ReorderRulesPage() {
  useDocumentTitle('Reorder Rules')
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showDelete, setShowDelete] = useState(null)
  const [formData, setFormData] = useState({ productId: '', warehouseId: '', minQty: 0, maxQty: 0, leadTimeDays: 0 })

  const { data: rules, isLoading } = useQuery({
    queryKey: ['reorder-rules'],
    queryFn: () => productService.getReorderRules().then((r) => {
      const items = r.data?.data || r.data?.rules || r.data || []
      return items.map((rule) => ({
        ...rule,
        product: rule.product || rule.productId,
        warehouse: rule.warehouse || rule.warehouseId,
      }))
    }),
  })

  const { data: products } = useQuery({
    queryKey: ['products-list'],
    queryFn: () => productService.getAll({ limit: 100 }).then((r) => r.data?.data || r.data?.products || r.data?.items || []),
  })

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehouseService.getAll().then((r) => r.data?.data || r.data?.warehouses || r.data || []),
  })

  const saveMutation = useMutation({
    mutationFn: (d) => {
      const payload = {
        productId: d.productId,
        warehouseId: d.warehouseId,
        minQty: d.minQty,
        maxQty: d.maxQty,
        leadTimeDays: d.leadTimeDays,
      }
      return editing ? productService.updateReorderRule(editing._id || editing.id, payload) : productService.createReorderRule(payload)
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['reorder-rules'] }); toast.success('Rule saved'); closeForm() },
    onError: (err) => toast.error(err.response?.data?.message || 'Save failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => productService.deleteReorderRule(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['reorder-rules'] }); toast.success('Rule deleted'); setShowDelete(null) },
  })

  const openNew = () => { setEditing(null); setFormData({ productId: '', warehouseId: '', minQty: 0, maxQty: 0, leadTimeDays: 0 }); setShowForm(true) }
  const openEdit = (rule) => { setEditing(rule); setFormData({ productId: rule.product?._id || rule.product, warehouseId: rule.warehouse?._id || rule.warehouse, minQty: rule.minQty, maxQty: rule.maxQty, leadTimeDays: rule.leadTimeDays }); setShowForm(true) }
  const closeForm = () => { setShowForm(false); setEditing(null) }

  const columns = [
    { key: 'product', label: 'Product', render: (r) => <span className="font-medium">{r.product?.name || '--'}</span> },
    { key: 'warehouse', label: 'Warehouse', render: (r) => r.warehouse?.name || '--' },
    { key: 'minQty', label: 'Min Qty' },
    { key: 'maxQty', label: 'Max Qty' },
    { key: 'leadTimeDays', label: 'Lead Time (days)' },
    {
      key: 'actions', label: '', render: (r) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); openEdit(r) }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"><PencilIcon className="w-4 h-4" /></button>
          <button onClick={(e) => { e.stopPropagation(); setShowDelete(r) }} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><TrashIcon className="w-4 h-4" /></button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Reorder Rules</h1>
        <Button onClick={openNew}><PlusIcon className="w-4 h-4" /> New Rule</Button>
      </div>
      <Table columns={columns} data={rules || []} loading={isLoading} emptyMessage="No reorder rules found." />

      <Modal isOpen={showForm} onClose={closeForm} title={editing ? 'Edit Rule' : 'New Rule'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Product</label>
            <select value={formData.productId} onChange={(e) => setFormData({ ...formData, productId: e.target.value })} className="input-field">
              <option value="">Select product...</option>
              {(products || []).map((p) => <option key={p._id || p.id} value={p._id || p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Warehouse</label>
            <select value={formData.warehouseId} onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })} className="input-field">
              <option value="">Select warehouse...</option>
              {(warehouses || []).map((w) => <option key={w._id || w.id} value={w._id || w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Min Qty</label>
              <input type="number" value={formData.minQty} onChange={(e) => setFormData({ ...formData, minQty: Number(e.target.value) })} className="input-field" min="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Max Qty</label>
              <input type="number" value={formData.maxQty} onChange={(e) => setFormData({ ...formData, maxQty: Number(e.target.value) })} className="input-field" min="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Lead Time</label>
              <input type="number" value={formData.leadTimeDays} onChange={(e) => setFormData({ ...formData, leadTimeDays: Number(e.target.value) })} className="input-field" min="0" />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={closeForm}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate(formData)} loading={saveMutation.isPending}>Save</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!showDelete} onClose={() => setShowDelete(null)}
        onConfirm={() => deleteMutation.mutate(showDelete?._id || showDelete?.id)}
        title="Delete Rule" message="Delete this reorder rule?" confirmLabel="Delete" />
    </div>
  )
}

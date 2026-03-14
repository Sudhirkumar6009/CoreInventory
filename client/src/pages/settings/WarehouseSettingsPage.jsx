import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { warehouseService } from '../../api/warehouseService'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import Button from '../../components/common/Button'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import Spinner from '../../components/common/Spinner'
import { PlusIcon, BuildingOffice2Icon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import toast from 'react-hot-toast'

export default function WarehouseSettingsPage() {
  useDocumentTitle('Warehouses')
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState(null)
  const [formData, setFormData] = useState({ name: '', shortCode: '', address: '' })
  const [showDelete, setShowDelete] = useState(false)

  const { data: warehouses, isLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehouseService.getAll().then((r) => r.data?.data || []),
  })

  useEffect(() => {
    if (selected) {
      setFormData({ name: selected.name || '', shortCode: selected.shortCode || '', address: selected.address || '' })
    }
  }, [selected])

  const saveMutation = useMutation({
    mutationFn: (d) => selected?._id || selected?.id
      ? warehouseService.update(selected._id || selected.id, d)
      : warehouseService.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success('Warehouse saved')
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Save failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => warehouseService.delete(selected?._id || selected?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success('Warehouse deleted')
      setSelected(null)
      setShowDelete(false)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Delete failed'),
  })

  const addNew = () => {
    setSelected({ _new: true })
    setFormData({ name: '', shortCode: '', address: '' })
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-5">Warehouses</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-3 border-b border-gray-100">
            <Button onClick={addNew} size="sm" className="w-full"><PlusIcon className="w-4 h-4" /> New Warehouse</Button>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            {(warehouses || []).map((w) => (
              <button key={w._id || w.id} onClick={() => setSelected(w)}
                className={clsx('w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors',
                  (selected?._id || selected?.id) === (w._id || w.id) && 'bg-brand-accent/5 border-l-2 border-l-brand-accent')}>
                <div className="flex items-center gap-3">
                  <BuildingOffice2Icon className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{w.name}</p>
                    <p className="text-xs text-gray-500">{w.shortCode}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Form */}
        <div className="lg:col-span-2">
          {selected ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-5">{selected._new ? 'New Warehouse' : 'Edit Warehouse'}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Name *</label>
                  <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Short Code *</label>
                  <input value={formData.shortCode} onChange={(e) => setFormData({ ...formData, shortCode: e.target.value })} className="input-field" placeholder="e.g. WH1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
                  <textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="input-field" rows={3} />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <Button onClick={() => saveMutation.mutate(formData)} loading={saveMutation.isPending}>Save</Button>
                  <Button variant="secondary" onClick={() => setSelected(null)}>Discard</Button>
                  {!selected._new && <Button variant="danger" onClick={() => setShowDelete(true)}>Delete</Button>}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-400">
              <BuildingOffice2Icon className="w-12 h-12 mx-auto mb-3" />
              <p>Select a warehouse or create a new one.</p>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog isOpen={showDelete} onClose={() => setShowDelete(false)} onConfirm={() => deleteMutation.mutate()}
        title="Delete Warehouse" message="Delete this warehouse? Only allowed if no stock exists." confirmLabel="Delete" loading={deleteMutation.isPending} />
    </div>
  )
}

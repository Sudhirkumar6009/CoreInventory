import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productService } from '../../api/productService'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useRole } from '../../hooks/useRole'
import Table from '../../components/common/Table'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

export default function CategoryListPage() {
  useDocumentTitle('Categories')
  const queryClient = useQueryClient()
  const { isManager } = useRole()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showDelete, setShowDelete] = useState(null)
  const [formData, setFormData] = useState({ name: '', shortCode: '', description: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => productService.getCategories().then((r) => r.data?.data || r.data?.categories || r.data || []),
  })

  const saveMutation = useMutation({
    mutationFn: (d) => editing ? productService.updateCategory(editing._id || editing.id, d) : productService.createCategory(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Category saved')
      closeForm()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Save failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => productService.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Category deleted')
      setShowDelete(null)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Delete failed'),
  })

  const openNew = () => { setEditing(null); setFormData({ name: '', shortCode: '', description: '' }); setShowForm(true) }
  const openEdit = (cat) => { setEditing(cat); setFormData({ name: cat.name, shortCode: cat.shortCode || '', description: cat.description || '' }); setShowForm(true) }
  const closeForm = () => { setShowForm(false); setEditing(null) }

  const columns = [
    { key: 'name', label: 'Name', render: (r) => <span className="font-medium text-gray-900">{r.name}</span> },
    { key: 'shortCode', label: 'Short Code' },
    { key: 'description', label: 'Description', render: (r) => r.description || '--' },
    {
      key: 'actions', label: '', render: (r) => isManager ? (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); openEdit(r) }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"><PencilIcon className="w-4 h-4" /></button>
          <button onClick={(e) => { e.stopPropagation(); setShowDelete(r) }} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><TrashIcon className="w-4 h-4" /></button>
        </div>
      ) : null,
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
        {isManager && <Button onClick={openNew}><PlusIcon className="w-4 h-4" /> New Category</Button>}
      </div>
      <Table columns={columns} data={data || []} loading={isLoading} emptyMessage="No categories found." />

      <Modal isOpen={showForm} onClose={closeForm} title={editing ? 'Edit Category' : 'New Category'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name *</label>
            <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Short Code</label>
            <input value={formData.shortCode} onChange={(e) => setFormData({ ...formData, shortCode: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input-field" rows={2} />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={closeForm}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate(formData)} loading={saveMutation.isPending}>Save</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!showDelete} onClose={() => setShowDelete(null)}
        onConfirm={() => deleteMutation.mutate(showDelete?._id || showDelete?.id)}
        title="Delete Category" message={`Delete "${showDelete?.name}"? This cannot be undone.`}
        confirmLabel="Delete" loading={deleteMutation.isPending} />
    </div>
  )
}

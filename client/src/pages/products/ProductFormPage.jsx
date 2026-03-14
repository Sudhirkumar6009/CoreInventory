import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productService } from '../../api/productService'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import Button from '../../components/common/Button'
import Spinner from '../../components/common/Spinner'
import { UOM_OPTIONS } from '../../constants'
import toast from 'react-hot-toast'

export default function ProductFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id || id === 'new'
  useDocumentTitle(isNew ? 'New Product' : 'Edit Product')

  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productService.getById(id).then((r) => r.data),
    enabled: !isNew,
  })

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => productService.getCategories().then((r) => r.data?.categories || r.data || []),
  })

  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        sku: product.sku || product.code,
        category: product.category?._id || product.category,
        unitOfMeasure: product.unitOfMeasure,
        perUnitCost: product.perUnitCost,
        reorderPoint: product.reorderPoint,
        maxStock: product.maxStock,
        description: product.description,
      })
    }
  }, [product, reset])

  const mutation = useMutation({
    mutationFn: (data) => isNew ? productService.create(data) : productService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product saved')
      navigate('/products')
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Save failed'),
  })

  if (isLoading && !isNew) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{isNew ? 'New Product' : 'Edit Product'}</h1>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => navigate('/products')}>Discard</Button>
          <Button onClick={handleSubmit((d) => mutation.mutate(d))} loading={mutation.isPending}>Save Product</Button>
        </div>
      </div>

      <form className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name *</label>
            <input {...register('name', { required: 'Name is required', maxLength: { value: 100, message: 'Max 100 chars' } })}
              className="input-field" placeholder="Product name" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">SKU / Code *</label>
            <input {...register('sku', { required: 'SKU is required', pattern: { value: /^[a-zA-Z0-9\-_]+$/, message: 'Only letters, numbers, - and _' } })}
              className="input-field" placeholder="e.g. STL-ROD-001" />
            {errors.sku && <p className="text-xs text-red-500 mt-1">{errors.sku.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Category *</label>
            <select {...register('category', { required: 'Category is required' })} className="input-field">
              <option value="">Select category...</option>
              {(categories || []).map((c) => <option key={c._id || c.id} value={c._id || c.id}>{c.name}</option>)}
            </select>
            {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Unit of Measure</label>
            <select {...register('unitOfMeasure')} className="input-field">
              {UOM_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Per Unit Cost</label>
            <input type="number" {...register('perUnitCost', { min: 0 })} className="input-field" placeholder="0.00" step="0.01" />
          </div>
          {isNew && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Initial Stock</label>
              <input type="number" {...register('initialStock', { min: 0 })} className="input-field" placeholder="0" min="0" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Reorder Point</label>
            <input type="number" {...register('reorderPoint', { min: 0 })} className="input-field" placeholder="0" min="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Max Stock</label>
            <input type="number" {...register('maxStock', { min: 0 })} className="input-field" placeholder="0" min="0" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea {...register('description', { maxLength: { value: 500, message: 'Max 500 chars' } })}
              className="input-field" rows={3} placeholder="Product description..." />
            {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}
          </div>
        </div>
      </form>
    </div>
  )
}

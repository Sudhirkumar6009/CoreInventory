import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adjustmentService } from '../../api/adjustmentService'
import { productService } from '../../api/productService'
import { warehouseService } from '../../api/warehouseService'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { previewRef } from '../../utils/generateReference'
import Button from '../../components/common/Button'
import Spinner from '../../components/common/Spinner'
import toast from 'react-hot-toast'

export default function AdjustmentFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id || id === 'new' || id === 'undefined'
  useDocumentTitle(isNew ? 'New Adjustment' : `Adjustment ${id}`)

  const { register, handleSubmit, reset, formState: { errors } } = useForm()
  const [lines, setLines] = useState([])

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => warehouseService.getLocations().then((r) => r.data?.data || r.data?.locations || r.data || []),
  })

  const { data: products = [] } = useQuery({
    queryKey: ['products', 'adjustment-form'],
    queryFn: () => productService.getAll({ limit: 500 }).then((r) => r.data?.data || r.data?.products || r.data || []),
  })

  const { data: adjustment, isLoading: fetchLoading } = useQuery({
    queryKey: ['adjustment', id],
    queryFn: () => adjustmentService.getById(id).then((r) => r.data?.data || r.data),
    enabled: !isNew,
  })

  useEffect(() => {
    if (adjustment) {
      reset({
        reference: adjustment.reference,
        date: (adjustment.adjustmentDate || adjustment.date)?.split('T')[0],
        locationId: adjustment.locationId?._id || adjustment.location?._id || adjustment.locationId || adjustment.location,
      })
      const loadedLines = (adjustment.lines || adjustment.items || []).map((line) => {
        const productObj = typeof line.productId === 'object' ? line.productId : null
        const productId = productObj?._id || line.productId || ''
        return {
          id: line.id || line._id || crypto.randomUUID(),
          productId,
          itemName: line.itemName || productObj?.name || line.productName || '',
          sku: line.sku || productObj?.sku || '',
          recordedQty: Number(line.recordedQty || 0),
          updatedQty: Number(line.updatedQty ?? line.countedQty ?? 0),
        }
      })
      setLines(loadedLines)
    } else if (isNew) {
      reset({ reference: previewRef('ADJ'), date: new Date().toISOString().split('T')[0], locationId: '' })
    }
  }, [adjustment, isNew, reset])

  const saveMutation = useMutation({
    mutationFn: (data) => isNew ? adjustmentService.create(data) : adjustmentService.update(id, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['adjustments'] })
      toast.success('Adjustment saved')
      const created = res.data?.data || res.data
      if (isNew) navigate(`/operations/adjustments/${created?._id || created?.id}`, { replace: true })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Save failed'),
  })

  const onSave = (formData) => {
    if (!formData.locationId) {
      toast.error('Location is required')
      return
    }

    const cleanLines = lines
      .filter((line) => line.productId && Number.isFinite(Number(line.updatedQty)))
      .map((line) => ({
        productId: line.productId,
        itemName: line.itemName,
        sku: line.sku,
        updatedQty: Number(line.updatedQty),
      }))

    if (cleanLines.length === 0) {
      toast.error('Add at least one valid product line')
      return
    }

    saveMutation.mutate({
      reference: formData.reference || previewRef('ADJ'),
      date: formData.date,
      locationId: formData.locationId,
      lines: cleanLines,
    })
  }

  if (fetchLoading && !isNew) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  const addLine = () => {
    setLines([...lines, { id: crypto.randomUUID(), productId: '', itemName: '', sku: '', recordedQty: 0, updatedQty: 0 }])
  }

  const updateLine = (lineId, field, value) => {
    setLines((prev) => prev.map((line) => (line.id === lineId ? { ...line, [field]: value } : line)))
  }

  const removeLine = (lineId) => { setLines(lines.filter((l) => l.id !== lineId)) }

  const handleProductChange = (lineId, selectedProductId) => {
    const product = products.find((p) => String(p._id || p.id) === String(selectedProductId))
    if (!product) {
      updateLine(lineId, 'productId', '')
      updateLine(lineId, 'itemName', '')
      updateLine(lineId, 'sku', '')
      updateLine(lineId, 'recordedQty', 0)
      return
    }

    setLines((prev) => prev.map((line) => (
      line.id === lineId
        ? {
          ...line,
          productId: product._id || product.id,
          itemName: product.name,
          sku: product.sku || '',
          recordedQty: Number(product.onHand || 0),
        }
        : line
    )))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{isNew ? 'New Adjustment' : adjustment?.reference || 'Adjustment'}</h1>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => navigate('/operations/adjustments')}>Back</Button>
          <Button onClick={handleSubmit(onSave)} loading={saveMutation.isPending}>Save</Button>
        </div>
      </div>

      <form className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Reference No *</label>
            <input
              {...register('reference', { required: 'Reference is required' })}
              className="input-field"
              placeholder="Enter reference"
              disabled={isReadOnly}
            />
            {errors.reference && <p className="text-xs text-red-500 mt-1">{errors.reference.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
            <input type="date" {...register('date')} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
            <select {...register('locationId', { required: 'Location is required' })} className="input-field">
              <option value="">Select location...</option>
              {(locations || []).map((l) => <option key={l._id || l.id} value={l._id || l.id}>{l.name}</option>)}
            </select>
            {errors.locationId && <p className="text-xs text-red-500 mt-1">{errors.locationId.message}</p>}
          </div>
        </div>
      </form>

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Product Lines</h2>
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Item Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-40">SKU</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-28">Recorded Qty</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-28">Updated Qty</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-28">Delta</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lines.map((line) => {
                const delta = Number(line.updatedQty || 0) - Number(line.recordedQty || 0)
                return (
                  <tr key={line.id} className="group">
                    <td className="px-4 py-2">
                      <select
                        value={line.productId || ''}
                        onChange={(e) => handleProductChange(line.id, e.target.value)}
                        className="input-field text-sm"
                      >
                        <option value="">Select product...</option>
                        {products.map((product) => (
                          <option key={product._id || product.id} value={product._id || product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input value={line.sku || ''} className="input-field text-sm bg-gray-50" readOnly />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" value={line.recordedQty || 0} className="input-field text-sm bg-gray-50" readOnly />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={line.updatedQty || 0}
                        onChange={(e) => updateLine(line.id, 'updatedQty', Number(e.target.value))}
                        className="input-field text-sm"
                        min="0"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-sm font-medium ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {delta > 0 ? `+${delta}` : delta === 0 ? 'No change' : delta}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => removeLine(line.id)}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                      >
                        x
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <button
            type="button"
            onClick={addLine}
            className="w-full py-3 text-sm text-brand-accent hover:bg-brand-accent/5 transition-colors flex items-center justify-center gap-2 border-t border-gray-100"
          >
            + Add a line
          </button>
        </div>
      </div>
    </div>
  )
}

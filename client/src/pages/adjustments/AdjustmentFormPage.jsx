import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adjustmentService } from '../../api/adjustmentService'
import { warehouseService } from '../../api/warehouseService'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { previewRef } from '../../utils/generateReference'
import Button from '../../components/common/Button'
import StatusStepper from '../../components/common/StatusStepper'
import Spinner from '../../components/common/Spinner'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const STEPS = ['Draft', 'Done']

export default function AdjustmentFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = id === 'new'
  useDocumentTitle(isNew ? 'New Adjustment' : `Adjustment ${id}`)

  const { register, handleSubmit, reset } = useForm()
  const [lines, setLines] = useState([])
  const [status, setStatus] = useState('draft')
  const [showCancel, setShowCancel] = useState(false)

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => warehouseService.getLocations().then((r) => r.data?.data || r.data?.locations || r.data || []),
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
        date: adjustment.date?.split('T')[0],
        location: adjustment.location?._id || adjustment.location,
      })
      setLines(adjustment.lines || adjustment.items || [])
      setStatus(adjustment.status || 'draft')
    } else if (isNew) {
      reset({ reference: previewRef('ADJ'), date: new Date().toISOString().split('T')[0], location: '' })
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

  const validateMutation = useMutation({
    mutationFn: () => adjustmentService.validate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adjustments'] })
      queryClient.invalidateQueries({ queryKey: ['adjustment', id] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Adjustment validated! Stock updated.')
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Validation failed'),
  })

  const onSave = (formData) => { saveMutation.mutate({ ...formData, lines }) }
  const isReadOnly = status === 'done' || status === 'cancelled'

  if (fetchLoading && !isNew) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  const addLine = () => {
    setLines([...lines, { id: crypto.randomUUID(), productId: '', productName: '', recordedQty: 0, countedQty: 0, reason: '' }])
  }

  const updateLine = (lineId, field, value) => {
    setLines(lines.map((l) => l.id === lineId ? { ...l, [field]: value } : l))
  }

  const removeLine = (lineId) => { setLines(lines.filter((l) => l.id !== lineId)) }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{isNew ? 'New Adjustment' : adjustment?.reference || 'Adjustment'}</h1>
        <div className="flex items-center gap-3">
          {status === 'draft' && (
            <>
              <Button variant="secondary" onClick={() => navigate('/operations/adjustments')}>Discard</Button>
              <Button onClick={handleSubmit(onSave)} loading={saveMutation.isPending}>Save</Button>
              {!isNew && <Button variant="success" onClick={() => validateMutation.mutate()} loading={validateMutation.isPending}>Validate</Button>}
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <StatusStepper steps={STEPS} current={status?.charAt(0).toUpperCase() + status?.slice(1)} />
      </div>

      <form className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Reference No</label>
            <input {...register('reference')} className="input-field bg-gray-50" readOnly />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
            <input type="date" {...register('date')} className="input-field" disabled={isReadOnly} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
            <select {...register('location')} className="input-field" disabled={isReadOnly}>
              <option value="">Select location...</option>
              {(locations || []).map((l) => <option key={l._id || l.id} value={l._id || l.id}>{l.name}</option>)}
            </select>
          </div>
        </div>
      </form>

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Product Lines</h2>
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-28">Recorded Qty</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-28">Counted Qty</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-28">Delta</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Reason</th>
                {!isReadOnly && <th className="w-12" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lines.map((line) => {
                const delta = (line.countedQty || 0) - (line.recordedQty || 0)
                return (
                  <tr key={line.id} className="group">
                    <td className="px-4 py-2">
                      <input value={line.productName || ''} onChange={(e) => updateLine(line.id, 'productName', e.target.value)}
                        className="input-field text-sm" placeholder="Product name" disabled={isReadOnly} />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" value={line.recordedQty || 0} className="input-field text-sm bg-gray-50" readOnly />
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" value={line.countedQty || 0}
                        onChange={(e) => updateLine(line.id, 'countedQty', Number(e.target.value))}
                        className="input-field text-sm" min="0" disabled={isReadOnly} />
                    </td>
                    <td className="px-4 py-2">
                      <span className={clsx('text-sm font-medium',
                        delta > 0 && 'text-green-600', delta < 0 && 'text-red-600', delta === 0 && 'text-gray-400'
                      )}>
                        {delta > 0 ? `+${delta}` : delta === 0 ? 'No change' : delta}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <input value={line.reason || ''} onChange={(e) => updateLine(line.id, 'reason', e.target.value)}
                        className="input-field text-sm" placeholder="Reason" disabled={isReadOnly} />
                    </td>
                    {!isReadOnly && (
                      <td className="px-2 py-2">
                        <button onClick={() => removeLine(line.id)}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
                          ✕
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!isReadOnly && (
            <button onClick={addLine}
              className="w-full py-3 text-sm text-brand-accent hover:bg-brand-accent/5 transition-colors flex items-center justify-center gap-2 border-t border-gray-100">
              + Add a line
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

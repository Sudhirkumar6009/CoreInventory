import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { transferService } from '../../api/transferService'
import { warehouseService } from '../../api/warehouseService'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { previewRef } from '../../utils/generateReference'
import Button from '../../components/common/Button'
import StatusStepper from '../../components/common/StatusStepper'
import LineItemTable from '../../components/common/LineItemTable'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import Spinner from '../../components/common/Spinner'
import toast from 'react-hot-toast'

const STEPS = ['Draft', 'Waiting', 'Ready', 'Done']

const getLineProductId = (line) => {
  const raw = line?.productId || line?.product
  if (!raw) return ''
  if (typeof raw === 'string') return raw
  return raw._id || raw.id || ''
}

const normalizeLines = (rawLines = []) => {
  return rawLines.map((line, idx) => ({
    id: line.id || line._id || `line-${idx}`,
    productId: getLineProductId(line),
    productName: line.productName || line.productId?.name || line.product?.name || '',
    qty: Number(line.qty ?? line.qtyOrdered ?? 0),
    qtyDone: Number(line.qtyDone ?? 0),
    uom: line.uom || line.productId?.uom || line.product?.uom || 'units',
    fromLocationId: line.fromLocationId?._id || line.fromLocationId || null,
    toLocationId: line.toLocationId?._id || line.toLocationId || null,
  }))
}

export default function TransferFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = id === 'new'
  useDocumentTitle(isNew ? 'New Transfer' : `Transfer ${id}`)

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm()
  const [lines, setLines] = useState([])
  const [status, setStatus] = useState('draft')
  const [showCancel, setShowCancel] = useState(false)

  const srcLoc = watch('sourceLocation')
  const destLoc = watch('destinationLocation')
  const sameLocation = srcLoc && destLoc && srcLoc === destLoc

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => warehouseService.getLocations().then((r) => r.data?.data || r.data?.locations || r.data || []),
  })

  const { data: transfer, isLoading: fetchLoading } = useQuery({
    queryKey: ['transfer', id],
    queryFn: () => transferService.getById(id).then((r) => r.data?.data || r.data),
    enabled: !isNew,
  })

  useEffect(() => {
    if (transfer) {
      reset({
        reference: transfer.reference,
        sourceLocation: transfer.sourceLocation?._id || transfer.sourceLocation,
        destinationLocation: transfer.destinationLocation?._id || transfer.destinationLocation,
        scheduledDate: transfer.scheduledDate?.split('T')[0],
      })
      setLines(normalizeLines(transfer.moveLines || transfer.lines || transfer.items || []))
      setStatus(transfer.status || 'draft')
    } else if (isNew) {
      reset({ reference: previewRef('INT'), sourceLocation: '', destinationLocation: '', scheduledDate: '' })
    }
  }, [transfer, isNew, reset])

  const saveMutation = useMutation({
    mutationFn: (data) => isNew ? transferService.create(data) : transferService.update(id, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
      toast.success('Transfer saved')
      const created = res.data?.data || res.data
      if (isNew) navigate(`/operations/transfers/${created?._id || created?.id}`, { replace: true })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Save failed'),
  })

  const validateMutation = useMutation({
    mutationFn: () => transferService.validate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
      queryClient.invalidateQueries({ queryKey: ['transfer', id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] })
      toast.success('Transfer validated!')
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Validation failed'),
  })

  const cancelMutation = useMutation({
    mutationFn: () => transferService.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
      queryClient.invalidateQueries({ queryKey: ['transfer', id] })
      toast.success('Transfer cancelled')
      setShowCancel(false)
    },
  })

  const onSave = (formData) => {
    const hasPartialLines = (lines || []).some((line) => {
      const productId = getLineProductId(line)
      const qtyOrdered = Number(line.qty || line.qtyOrdered || 0)
      const hasAnyData = !!productId || qtyOrdered > 0 || Number(line.qtyDone || 0) > 0
      const isValid = !!productId && qtyOrdered > 0
      return hasAnyData && !isValid
    })

    if (hasPartialLines) {
      toast.error('Complete product and quantity for each line, or remove incomplete lines')
      return
    }

    const moveLines = (lines || [])
      .map((line) => ({
        productId: getLineProductId(line),
        qtyOrdered: Number(line.qty || line.qtyOrdered || 0),
        qtyDone: Number(line.qtyDone || 0),
        uom: line.uom || 'units',
        fromLocationId: line.fromLocationId || null,
        toLocationId: line.toLocationId || null,
      }))
      .filter((line) => line.productId && line.qtyOrdered > 0)

    saveMutation.mutate({ ...formData, moveLines })
  }
  const isReadOnly = status === 'done' || status === 'cancelled'
  if (fetchLoading && !isNew) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  const locationOptions = (locations || []).map((l) => ({ value: l._id || l.id, label: l.name }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{isNew ? 'New Transfer' : transfer?.reference || 'Transfer'}</h1>
        <div className="flex items-center gap-3">
          {status === 'draft' && (
            <>
              <Button variant="secondary" onClick={() => navigate('/operations/transfers')}>Discard</Button>
              <Button onClick={handleSubmit(onSave)} loading={saveMutation.isPending} disabled={sameLocation}>Save</Button>
            </>
          )}
          {(status === 'waiting' || status === 'ready') && (
            <>
              <Button variant="secondary" onClick={() => setShowCancel(true)}>Cancel</Button>
              <Button onClick={() => validateMutation.mutate()} loading={validateMutation.isPending}>Validate</Button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <StatusStepper steps={STEPS} current={status?.charAt(0).toUpperCase() + status?.slice(1)} />
      </div>

      <form className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Scheduled Date</label>
            <input type="date" {...register('scheduledDate')} className="input-field" disabled={isReadOnly} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Source Location *</label>
            <select {...register('sourceLocation', { required: 'Required' })} className="input-field" disabled={isReadOnly}>
              <option value="">Select location...</option>
              {locationOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {errors.sourceLocation && <p className="text-xs text-red-500 mt-1">{errors.sourceLocation.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Destination Location *</label>
            <select {...register('destinationLocation', { required: 'Required' })} className="input-field" disabled={isReadOnly}>
              <option value="">Select location...</option>
              {locationOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {errors.destinationLocation && <p className="text-xs text-red-500 mt-1">{errors.destinationLocation.message}</p>}
            {sameLocation && <p className="text-xs text-red-500 mt-1">Source and destination cannot be the same location.</p>}
          </div>
        </div>
      </form>

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Product Lines</h2>
        <LineItemTable lines={lines} onChange={setLines} readOnly={isReadOnly} />
      </div>

      <ConfirmDialog isOpen={showCancel} onClose={() => setShowCancel(false)} onConfirm={() => cancelMutation.mutate()}
        title="Cancel Transfer" message="Are you sure you want to cancel this transfer?" confirmLabel="Cancel Transfer" />
    </div>
  )
}

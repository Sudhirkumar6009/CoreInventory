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

const toNumberOrDefault = (value, fallback = 0) => {
  if (value === undefined || value === null || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const normalizeLineFromApi = (line = {}) => {
  const productObj = typeof line.productId === 'object' ? line.productId : null
  const qtyOrdered = toNumberOrDefault(line.qtyOrdered ?? line.qty, 0)
  return {
    id: line._id || line.id || crypto.randomUUID(),
    productId: productObj?._id || line.productId || '',
    productName: line.productName || productObj?.name || '',
    description: line.description || '',
    qty: qtyOrdered,
    qtyOrdered,
    qtyDone: toNumberOrDefault(line.qtyDone, 0),
    uom: line.uom || productObj?.uom || 'units',
    fromLocationId: line.fromLocationId?._id || line.fromLocationId || '',
    toLocationId: line.toLocationId?._id || line.toLocationId || '',
  }
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

  // Fetch available locations for dropdowns
  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () =>
      warehouseService.getLocations().then((r) => r.data?.data || r.data?.locations || r.data || []),
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
        sourceLocation: transfer.sourceLocation?._id || transfer.sourceLocation || '',
        destinationLocation: transfer.destinationLocation?._id || transfer.destinationLocation || '',
        scheduledDate: transfer.scheduledDate?.split('T')[0],
        notes: transfer.notes || '',
      })
      const apiLines = transfer.moveLines || transfer.lines || transfer.items || []
      setLines(apiLines.map(normalizeLineFromApi))
      setStatus(transfer.status || 'draft')
    } else if (isNew) {
      reset({
        reference: previewRef('INT'),
        sourceLocation: '',
        destinationLocation: '',
        scheduledDate: new Date().toISOString().split('T')[0],
        notes: '',
      })
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
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Transfer validated! Stock moved between locations.')
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
    onError: (err) => toast.error(err.response?.data?.message || 'Cancel failed'),
  })

  // Build move lines injecting the header-level source/dest locations into each line
  const onSave = (formData) => {
    const fromLocationId = formData.sourceLocation || undefined
    const toLocationId = formData.destinationLocation || undefined

    const moveLines = lines
      .filter((line) => line.productId)
      .map((line) => ({
        productId: line.productId,
        description: line.description || '',
        qtyOrdered: toNumberOrDefault(line.qtyOrdered ?? line.qty, 0),
        qtyDone: toNumberOrDefault(line.qtyDone, 0),
        uom: line.uom || 'units',
        // Use line-level override if set, otherwise use form header values
        fromLocationId: line.fromLocationId || fromLocationId,
        toLocationId: line.toLocationId || toLocationId,
      }))

    saveMutation.mutate({
      reference: formData.reference,
      scheduledDate: formData.scheduledDate,
      notes: formData.notes,
      sourceDocument: formData.sourceDocument,
      status: 'draft',
      moveLines,
    })
  }

  const isReadOnly = status === 'done' || status === 'cancelled'

  if (fetchLoading && !isNew) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  const locationOptions = locations.map((l) => ({
    value: l._id || l.id,
    label: `${l.name}${l.shortCode ? ` (${l.shortCode})` : ''}`,
  }))

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isNew ? 'New Transfer' : transfer?.reference || 'Transfer'}
        </h1>
        <div className="flex items-center gap-3">
          {status === 'draft' && (
            <>
              <Button variant="secondary" onClick={() => navigate('/operations/transfers')}>Discard</Button>
              <Button
                onClick={handleSubmit(onSave)}
                loading={saveMutation.isPending}
                disabled={!!sameLocation}
              >
                Save
              </Button>
            </>
          )}
          {(status === 'waiting' || status === 'ready') && (
            <>
              <Button variant="secondary" onClick={() => setShowCancel(true)}>Cancel</Button>
              <Button onClick={() => validateMutation.mutate()} loading={validateMutation.isPending}>
                {status === 'ready' ? 'Mark as Done' : 'Validate'}
              </Button>
            </>
          )}
          {(status === 'done' || status === 'cancelled') && (
            <Button variant="secondary" onClick={() => navigate('/operations/transfers')}>Back to List</Button>
          )}
        </div>
      </div>

      {/* Status Stepper */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <StatusStepper steps={STEPS} current={status?.charAt(0).toUpperCase() + status?.slice(1)} />
      </div>

      {/* Form Fields */}
      <form className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Reference No *</label>
            <input
              {...register('reference', { required: 'Reference is required' })}
              className="input-field"
              placeholder="e.g. WH/INT/00001"
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
            <select
              {...register('sourceLocation', { required: 'Source location is required' })}
              className="input-field"
              disabled={isReadOnly}
            >
              <option value="">Select source location...</option>
              {locationOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {errors.sourceLocation && <p className="text-xs text-red-500 mt-1">{errors.sourceLocation.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Destination Location *</label>
            <select
              {...register('destinationLocation', { required: 'Destination location is required' })}
              className="input-field"
              disabled={isReadOnly}
            >
              <option value="">Select destination location...</option>
              {locationOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {errors.destinationLocation && <p className="text-xs text-red-500 mt-1">{errors.destinationLocation.message}</p>}
            {sameLocation && (
              <p className="text-xs text-red-500 mt-1">Source and destination cannot be the same location.</p>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
            <textarea {...register('notes')} className="input-field" rows={2} placeholder="Optional notes..." disabled={isReadOnly} />
          </div>
        </div>
      </form>

      {/* Product Lines */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Product Lines</h2>
        <div className="text-sm text-teal-700 bg-teal-50 border border-teal-100 rounded-lg px-4 py-2 mb-3">
          Products will be moved from <strong>Source Location → Destination Location</strong> selected above.
        </div>
        <LineItemTable
          lines={lines}
          onChange={setLines}
          readOnly={isReadOnly}
        />
      </div>

      <ConfirmDialog
        isOpen={showCancel}
        onClose={() => setShowCancel(false)}
        onConfirm={() => cancelMutation.mutate()}
        title="Cancel Transfer"
        message="Are you sure you want to cancel this transfer? This action cannot be undone."
        confirmLabel="Cancel Transfer"
      />
    </div>
  )
}

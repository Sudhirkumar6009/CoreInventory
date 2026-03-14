import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { deliveryService } from '../../api/deliveryService'
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
  }))
}

export default function DeliveryFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = id === 'new'
  useDocumentTitle(isNew ? 'New Delivery' : `Delivery ${id}`)

  const { register, handleSubmit, reset, formState: { errors } } = useForm()
  const [lines, setLines] = useState([])
  const [status, setStatus] = useState('draft')
  const [showCancel, setShowCancel] = useState(false)

  const { data: delivery, isLoading: fetchLoading } = useQuery({
    queryKey: ['delivery', id],
    queryFn: () => deliveryService.getById(id).then((r) => r.data?.data || r.data),
    enabled: !isNew,
  })

  useEffect(() => {
    if (delivery) {
      reset({
        reference: delivery.reference,
        customer: delivery.customer,
        scheduledDate: delivery.scheduledDate?.split('T')[0],
        carrier: delivery.carrier,
        sourceDocument: delivery.sourceDocument,
      })
      setLines(normalizeLines(delivery.moveLines || delivery.lines || delivery.items || []))
      setStatus(delivery.status || 'draft')
    } else if (isNew) {
      reset({ reference: previewRef('OUT'), customer: '', scheduledDate: '', carrier: '', sourceDocument: '' })
    }
  }, [delivery, isNew, reset])

  const saveMutation = useMutation({
    mutationFn: (data) => isNew ? deliveryService.create(data) : deliveryService.update(id, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] })
      toast.success('Delivery saved')
      const created = res.data?.data || res.data
      const newId = created?._id || created?.id || id
      if (isNew) navigate(`/operations/deliveries/${newId}`, { replace: true })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Save failed'),
  })

  const validateMutation = useMutation({
    mutationFn: () => deliveryService.validate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] })
      queryClient.invalidateQueries({ queryKey: ['delivery', id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] })
      queryClient.invalidateQueries({ queryKey: ['moves'] })
      toast.success('Delivery validated! Stock updated.')
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Validation failed'),
  })

  const cancelMutation = useMutation({
    mutationFn: () => deliveryService.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] })
      queryClient.invalidateQueries({ queryKey: ['delivery', id] })
      toast.success('Delivery cancelled')
      setShowCancel(false)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Cancel failed'),
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
      }))
      .filter((line) => line.productId && line.qtyOrdered > 0)

    saveMutation.mutate({ ...formData, moveLines, status: 'draft' })
  }

  const isReadOnly = status === 'done' || status === 'cancelled'

  if (fetchLoading && !isNew) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isNew ? 'New Delivery' : delivery?.reference || 'Delivery'}
        </h1>
        <div className="flex items-center gap-3">
          {status === 'draft' && (
            <>
              <Button variant="secondary" onClick={() => navigate('/operations/deliveries')}>Discard</Button>
              <Button onClick={handleSubmit(onSave)} loading={saveMutation.isPending}>Save</Button>
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
          {status === 'done' && (
            <Button variant="secondary" onClick={() => navigate('/operations/deliveries')}>Back to List</Button>
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Customer *</label>
            <input {...register('customer', { required: 'Customer is required' })} className="input-field" placeholder="Customer name" disabled={isReadOnly} />
            {errors.customer && <p className="text-xs text-red-500 mt-1">{errors.customer.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Scheduled Date *</label>
            <input type="date" {...register('scheduledDate', { required: 'Date is required' })} className="input-field" disabled={isReadOnly} />
            {errors.scheduledDate && <p className="text-xs text-red-500 mt-1">{errors.scheduledDate.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Carrier</label>
            <input {...register('carrier')} className="input-field" placeholder="Carrier name" disabled={isReadOnly} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Source Document</label>
            <input {...register('sourceDocument')} className="input-field" placeholder="Sales Order ref" disabled={isReadOnly} />
          </div>
        </div>
      </form>

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Product Lines</h2>
        <LineItemTable lines={lines} onChange={setLines} readOnly={isReadOnly} />
      </div>

      <ConfirmDialog
        isOpen={showCancel} onClose={() => setShowCancel(false)} onConfirm={() => cancelMutation.mutate()}
        title="Cancel Delivery" message="Are you sure you want to cancel this delivery?" confirmLabel="Cancel Delivery"
        loading={cancelMutation.isPending}
      />
    </div>
  )
}

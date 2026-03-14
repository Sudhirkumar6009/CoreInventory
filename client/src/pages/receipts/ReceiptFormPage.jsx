import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { receiptService } from '../../api/receiptService'
import { useAuthStore } from '../../store/authStore'
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
    toLocationId: line.toLocationId?._id || line.toLocationId || null,
  }))
}

export default function ReceiptFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)
  const isNew = !id || id === 'new' || id === 'undefined'
  useDocumentTitle(isNew ? 'New Receipt' : `Receipt ${id}`)

  const { register, handleSubmit, reset, formState: { errors } } = useForm()
  const [lines, setLines] = useState([])
  const [status, setStatus] = useState('draft')
  const [showCancel, setShowCancel] = useState(false)

  // Fetch existing receipt
  const { data: receipt, isLoading: fetchLoading } = useQuery({
    queryKey: ['receipt', id],
    queryFn: () => receiptService.getById(id).then((r) => r.data?.data || r.data),
    enabled: !isNew,
  })

  useEffect(() => {
    if (receipt) {
      reset({
        reference: receipt.reference,
        responsibleUser: receipt.createdBy?.email || currentUser?.email || '',
        scheduledDate: receipt.scheduledDate?.split('T')[0],
      })
      setLines(normalizeLines(receipt.moveLines || receipt.lines || receipt.items || []))
      setStatus(receipt.status || 'draft')
    } else if (isNew) {
      reset({
        reference: previewRef('IN'),
        responsibleUser: currentUser?.email || '',
        scheduledDate: '',
      })
    }
  }, [receipt, isNew, reset, currentUser?.email])

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (!isNew && !id) {
        throw new Error('Receipt id is missing for update')
      }
      return isNew ? receiptService.create(data) : receiptService.update(id, data)
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      toast.success('Receipt saved')
      const created = res.data?.data || res.data
      const newId = created?._id || created?.id || id
      if (isNew) navigate(`/operations/receipts/${newId}`, { replace: true })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Save failed'),
  })

  const validateMutation = useMutation({
    mutationFn: () => receiptService.validate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['receipt', id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] })
      queryClient.invalidateQueries({ queryKey: ['moves'] })
      toast.success('Receipt validated! Stock updated.')
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Validation failed'),
  })

  const cancelMutation = useMutation({
    mutationFn: () => receiptService.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['receipt', id] })
      toast.success('Receipt cancelled')
      setShowCancel(false)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Cancel failed'),
  })

  const returnMutation = useMutation({
    mutationFn: () => receiptService.return_(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['receipt', id] })
      toast.success('Return processed')
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Return failed'),
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
        toLocationId: line.toLocationId || null,
      }))
      .filter((line) => line.productId && line.qtyOrdered > 0)

    const payload = {
      reference: formData.reference,
      scheduledDate: formData.scheduledDate,
      status: 'draft',
      moveLines,
    }

    saveMutation.mutate(payload)
  }

  const isReadOnly = status === 'done' || status === 'cancelled'

  if (fetchLoading && !isNew) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  }

  return (
    <div>
      {/* Header with title and action buttons */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isNew ? 'New Receipt' : receipt?.reference || 'Receipt'}
        </h1>
        <div className="flex items-center gap-3">
          {status === 'draft' && (
            <>
              <Button variant="secondary" onClick={() => navigate('/operations/receipts')}>Discard</Button>
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
            <Button variant="secondary" onClick={() => returnMutation.mutate()} loading={returnMutation.isPending}>
              Return
            </Button>
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
              placeholder="Enter reference"
              disabled={isReadOnly}
            />
            {errors.reference && <p className="text-xs text-red-500 mt-1">{errors.reference.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Responsible User</label>
            <input
              {...register('responsibleUser')}
              className="input-field bg-gray-50"
              placeholder="User email"
              readOnly
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Scheduled Date *</label>
            <input
              type="date"
              {...register('scheduledDate', { required: 'Date is required' })}
              className="input-field" disabled={isReadOnly}
            />
            {errors.scheduledDate && <p className="text-xs text-red-500 mt-1">{errors.scheduledDate.message}</p>}
          </div>
        </div>
      </form>

      {/* Product Lines */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Product Lines</h2>
        <LineItemTable lines={lines} onChange={setLines} readOnly={isReadOnly} />
      </div>

      <ConfirmDialog
        isOpen={showCancel}
        onClose={() => setShowCancel(false)}
        onConfirm={() => cancelMutation.mutate()}
        title="Cancel Receipt"
        message="Are you sure you want to cancel this receipt? This action cannot be undone."
        confirmLabel="Cancel Receipt"
        loading={cancelMutation.isPending}
      />
    </div>
  )
}

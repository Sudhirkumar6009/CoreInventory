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
    queryFn: () => warehouseService.getLocations().then((r) => r.data?.locations || r.data || []),
  })

  const { data: transfer, isLoading: fetchLoading } = useQuery({
    queryKey: ['transfer', id],
    queryFn: () => transferService.getById(id).then((r) => r.data),
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
      setLines(transfer.lines || transfer.items || [])
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
      if (isNew) navigate(`/operations/transfers/${res.data?._id || res.data?.id}`, { replace: true })
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

  const onSave = (formData) => { saveMutation.mutate({ ...formData, lines }) }
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Reference No</label>
            <input {...register('reference')} className="input-field bg-gray-50" readOnly />
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

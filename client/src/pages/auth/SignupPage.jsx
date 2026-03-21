import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { authService } from '../../api/authService'
import { warehouseService } from '../../api/warehouseService'
import Button from '../../components/common/Button'
import toast from 'react-hot-toast'

export default function SignupPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('register') // 'register' | 'otp'
  const [email, setEmail] = useState('')

  const { register, handleSubmit, watch, formState: { errors } } = useForm()
  const password = watch('password')
  const role = watch('role')

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => warehouseService.getLocations().then(r => r.data?.data || r.data?.locations || []),
  })

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      await authService.register(data)
      setEmail(data.email)
      toast.success('Account created! Please verify your email.')
      setStep('otp')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const verifyOtp = async (otp) => {
    setLoading(true)
    try {
      await authService.verifyOtp({ email, otp })
      toast.success('Email verified! Please login.')
      navigate('/login')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'otp') {
    return <OtpStep onVerify={verifyOtp} loading={loading} />
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
        <input {...register('name', { required: 'Name is required' })} className="input-field" placeholder="John Doe" />
        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
        <input type="email" {...register('email', { required: 'Email is required' })} className="input-field" placeholder="you@example.com" />
        {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
        <input
          type="password"
          {...register('password', {
            required: 'Password is required',
            minLength: { value: 8, message: 'At least 8 characters' },
          })}
          className="input-field" placeholder="Min 8 characters"
        />
        {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
        <input
          type="password"
          {...register('confirmPassword', {
            required: 'Please confirm password',
            validate: (v) => v === password || 'Passwords do not match',
          })}
          className="input-field" placeholder="Re-enter password"
        />
        {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
        <select {...register('role', { required: 'Role is required' })} className="input-field">
          <option value="">Select role...</option>
          <option value="manager">Manager</option>
          <option value="staff">Staff</option>
        </select>
        {errors.role && <p className="text-xs text-red-500 mt-1">{errors.role.message}</p>}
      </div>

      {role === 'staff' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Assigned Location</label>
          <select
            {...register('locationId', { required: 'Location is required for staff' })}
            className="input-field"
          >
            <option value="">Select location...</option>
            {(locations || []).map(loc => (
              <option key={loc._id || loc.id} value={loc._id || loc.id}>
                {loc.name} {loc.shortCode ? `(${loc.shortCode})` : ''}
              </option>
            ))}
          </select>
          {errors.locationId && <p className="text-xs text-red-500 mt-1">{errors.locationId.message}</p>}
        </div>
      )}

      <Button type="submit" loading={loading} className="w-full" size="lg">
        Create Account
      </Button>

      <p className="text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link to="/login" className="text-brand-accent font-medium hover:text-rose-700">Sign In</Link>
      </p>
    </form>
  )
}

function OtpStep({ onVerify, loading }) {
  const [otp, setOtp] = useState('')

  return (
    <div className="space-y-5 text-center">
      <p className="text-sm text-gray-600">Enter the 6-digit OTP sent to your email.</p>
      <input
        type="text"
        maxLength={6}
        value={otp}
        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
        className="input-field text-center text-2xl tracking-[0.5em] font-mono"
        placeholder="000000"
      />
      <Button onClick={() => onVerify(otp)} loading={loading} disabled={otp.length !== 6} className="w-full">
        Verify OTP
      </Button>
    </div>
  )
}

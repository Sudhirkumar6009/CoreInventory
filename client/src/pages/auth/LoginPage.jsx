import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { EyeIcon, EyeSlashIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import { authService } from '../../api/authService'
import { useAuthStore } from '../../store/authStore'
import Button from '../../components/common/Button'
import toast from 'react-hot-toast'

const DEMO_ACCOUNTS = [
  {
    key: 'manager',
    label: 'Manager Demo Account',
    email: 'Manager1@gmail.com',
    password: 'Test@123',
  },
  {
    key: 'staff',
    label: 'Staff Demo Account',
    email: 'john1234@gmail.com',
    password: 'Test@123',
  },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, setValue, formState: { errors } } = useForm()

  const autoFillCredentials = (account) => {
    setValue('email', account.email, { shouldValidate: true })
    setValue('password', account.password, { shouldValidate: true })
  }

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      const res = await authService.login(data)
      const payload = res.data?.data || res.data
      const token = payload?.accessToken || payload?.token
      const user = payload?.user

      if (!token || !user) {
        throw new Error('Unexpected login response from server')
      }

      setAuth(token, user)
      toast.success('Welcome back!')
      const from = location.state?.from?.pathname || '/dashboard'
      navigate(from, { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-3">
        {DEMO_ACCOUNTS.map((account) => (
          <div
            key={account.key}
            className="rounded-xl border border-brand-accent/40 bg-brand-accent/5 p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-brand-accent">
                  <InformationCircleIcon className="h-5 w-5" />
                  {account.label}
                </p>
                <p className="mt-2 text-sm text-gray-700">Email: {account.email}</p>
                <p className="text-sm text-gray-700">Password: {account.password}</p>
              </div>
              <button
                type="button"
                onClick={() => autoFillCredentials(account)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Auto Fill
              </button>
            </div>
          </div>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
        <input
          type="email"
          {...register('email', { required: 'Email is required' })}
          className="input-field"
          placeholder="you@example.com"
        />
        {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            {...register('password', { required: 'Password is required' })}
            className="input-field pr-10"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
          </button>
        </div>
        {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="rounded border-gray-300 text-brand-accent focus:ring-brand-accent" />
          <span className="text-sm text-gray-600">Remember me</span>
        </label>
        <Link to="/reset-password" className="text-sm text-brand-accent hover:text-rose-700 font-medium">
          Forgot Password?
        </Link>
      </div>

      <Button type="submit" loading={loading} className="w-full" size="lg">
        Sign In
      </Button>

      <p className="text-center text-sm text-gray-500">
        Don't have an account?{' '}
        <Link to="/signup" className="text-brand-accent font-medium hover:text-rose-700">
          Sign Up
        </Link>
      </p>
    </form>
  )
}

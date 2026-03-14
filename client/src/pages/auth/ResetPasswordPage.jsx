import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '../../api/authService'
import Button from '../../components/common/Button'
import toast from 'react-hot-toast'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [countdown])

  const sendOtp = async () => {
    if (!email) return toast.error('Please enter your email')
    setLoading(true)
    try {
      await authService.sendOtp({ email })
      toast.success('OTP sent to your email')
      setCountdown(30)
      setStep(2)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  const verifyOtp = async () => {
    setLoading(true)
    try {
      await authService.verifyOtp({ email, otp })
      toast.success('OTP verified')
      setStep(3)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP')
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async () => {
    if (password !== confirmPassword) return toast.error('Passwords do not match')
    if (password.length < 8) return toast.error('Password must be at least 8 characters')
    setLoading(true)
    try {
      await authService.resetPassword({ email, otp, newPassword: password })
      toast.success('Password reset successfully')
      navigate('/login')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Step indicators */}
      <div className="flex items-center justify-center gap-2 mb-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`w-8 h-1 rounded-full transition-colors ${s <= step ? 'bg-brand-accent' : 'bg-gray-200'}`} />
        ))}
      </div>

      {step === 1 && (
        <>
          <p className="text-sm text-gray-600 text-center">Enter your email to receive a reset code.</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" placeholder="you@example.com" />
          </div>
          <Button onClick={sendOtp} loading={loading} className="w-full" size="lg">Send OTP</Button>
        </>
      )}

      {step === 2 && (
        <>
          <p className="text-sm text-gray-600 text-center">Enter the 6-digit code sent to <strong>{email}</strong></p>
          <input
            type="text" maxLength={6} value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            className="input-field text-center text-2xl tracking-[0.5em] font-mono"
            placeholder="000000"
          />
          {countdown > 0 ? (
            <p className="text-xs text-gray-400 text-center">Resend OTP in {countdown}s</p>
          ) : (
            <button onClick={sendOtp} className="text-sm text-brand-accent hover:text-rose-700 w-full text-center">Resend OTP</button>
          )}
          <Button onClick={verifyOtp} loading={loading} disabled={otp.length !== 6} className="w-full" size="lg">Verify OTP</Button>
        </>
      )}

      {step === 3 && (
        <>
          <p className="text-sm text-gray-600 text-center">Set your new password.</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" placeholder="Min 8 characters" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input-field" placeholder="Re-enter password" />
          </div>
          <Button onClick={resetPassword} loading={loading} className="w-full" size="lg">Reset Password</Button>
        </>
      )}
    </div>
  )
}

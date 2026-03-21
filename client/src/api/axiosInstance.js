import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim()
const trimmedBaseUrl = rawBaseUrl.replace(/\/+$/, '')
const baseURL = trimmedBaseUrl.endsWith('/api') ? trimmedBaseUrl : `${trimmedBaseUrl}/api`

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status
    const requestUrl = err.config?.url || ''
    const isAuthRequest = requestUrl.includes('/auth/login')
      || requestUrl.includes('/auth/register')
      || requestUrl.includes('/auth/send-otp')
      || requestUrl.includes('/auth/verify-otp')
      || requestUrl.includes('/auth/reset-password')
      || requestUrl.includes('/locations')

    if (status === 401 && !isAuthRequest) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

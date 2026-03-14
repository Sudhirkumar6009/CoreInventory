import { useAuthStore } from '../store/authStore'
import { useNavigate } from 'react-router-dom'
import { authService } from '../api/authService'
import toast from 'react-hot-toast'

export const useAuth = () => {
  const { token, user, setAuth, logout: storeLogout } = useAuthStore()
  const navigate = useNavigate()

  const login = async (email, password) => {
    const res = await authService.login({ email, password })
    const { token: t, user: u } = res.data
    setAuth(t, u)
    return res
  }

  const logout = () => {
    storeLogout()
    toast.success('Logged out successfully')
    navigate('/login')
  }

  return { token, user, isAuthenticated: !!token, login, logout }
}

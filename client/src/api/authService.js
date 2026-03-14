import api from './axiosInstance'

export const authService = {
  login:         (data) => api.post('/auth/login', data),
  register:      (data) => api.post('/auth/register', data),
  sendOtp:       (data) => api.post('/auth/send-otp', data),
  verifyOtp:     (data) => api.post('/auth/verify-otp', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  getProfile:    ()     => api.get('/auth/profile'),
}

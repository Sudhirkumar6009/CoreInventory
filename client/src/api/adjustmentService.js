import api from './axiosInstance'

export const adjustmentService = {
  getAll:    (params) => api.get('/adjustments', { params }),
  getById:   (id)     => api.get(`/adjustments/${id}`),
  create:    (data)   => api.post('/adjustments', data),
  update:    (id, data) => api.put(`/adjustments/${id}`, data),
}

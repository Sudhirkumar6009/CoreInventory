import api from './axiosInstance'

export const deliveryService = {
  getAll:    (params) => api.get('/deliveries', { params }),
  getById:   (id)     => api.get(`/deliveries/${id}`),
  create:    (data)   => api.post('/deliveries', data),
  update:    (id, data) => api.put(`/deliveries/${id}`, data),
  validate:  (id)     => api.post(`/deliveries/${id}/validate`),
  cancel:    (id)     => api.post(`/deliveries/${id}/cancel`),
  return_:   (id)     => api.post(`/deliveries/${id}/return`),
}

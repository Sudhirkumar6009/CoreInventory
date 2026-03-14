import api from './axiosInstance'

export const transferService = {
  getAll:    (params) => api.get('/transfers', { params }),
  getById:   (id)     => api.get(`/transfers/${id}`),
  create:    (data)   => api.post('/transfers', data),
  update:    (id, data) => api.put(`/transfers/${id}`, data),
  validate:  (id)     => api.post(`/transfers/${id}/validate`),
  cancel:    (id)     => api.post(`/transfers/${id}/cancel`),
}

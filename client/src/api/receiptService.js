import api from './axiosInstance'

export const receiptService = {
  getAll:    (params) => api.get('/receipts', { params }),
  getById:   (id)     => api.get(`/receipts/${id}`),
  create:    (data)   => api.post('/receipts', data),
  update:    (id, data) => api.put(`/receipts/${id}`, data),
  validate:  (id)     => api.post(`/receipts/${id}/validate`),
  cancel:    (id)     => api.post(`/receipts/${id}/cancel`),
  return_:   (id)     => api.post(`/receipts/${id}/return`),
}

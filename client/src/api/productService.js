import api from './axiosInstance'

export const productService = {
  getAll:        (params) => api.get('/products', { params }),
  getById:       (id)     => api.get(`/products/${id}`),
  create:        (data)   => api.post('/products', data),
  update:        (id, data) => api.put(`/products/${id}`, data),
  delete:        (id)     => api.delete(`/products/${id}`),
  getStock:      (id)     => api.get(`/products/${id}/stock`),
  getCategories: (params) => api.get('/products/categories', { params }),
  createCategory:(data)   => api.post('/products/categories', data),
  updateCategory:(id, data) => api.put(`/products/categories/${id}`, data),
  deleteCategory:(id)     => api.delete(`/products/categories/${id}`),
  getReorderRules: (params) => api.get('/products/reorder-rules', { params }),
  createReorderRule: (data) => api.post('/products/reorder-rules', data),
  updateReorderRule: (id, data) => api.put(`/products/reorder-rules/${id}`, data),
  deleteReorderRule: (id)     => api.delete(`/products/reorder-rules/${id}`),
}

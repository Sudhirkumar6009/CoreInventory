import api from './axiosInstance'

export const warehouseService = {
  getAll:     (params) => api.get('/warehouses', { params }),
  getById:    (id)     => api.get(`/warehouses/${id}`),
  create:     (data)   => api.post('/warehouses', data),
  update:     (id, data) => api.put(`/warehouses/${id}`, data),
  delete:     (id)     => api.delete(`/warehouses/${id}`),
  getLocations:    (params) => api.get('/locations', { params }),
  getLocationById: (id)     => api.get(`/locations/${id}`),
  createLocation:  (data)   => api.post('/locations', data),
  updateLocation:  (id, data) => api.put(`/locations/${id}`, data),
  deleteLocation:  (id)     => api.delete(`/locations/${id}`),
}

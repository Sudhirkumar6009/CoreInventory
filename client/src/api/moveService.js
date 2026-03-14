import api from './axiosInstance'

export const moveService = {
  getAll:    (params) => api.get('/moves', { params }),
  getById:   (id)     => api.get(`/moves/${id}`),
}

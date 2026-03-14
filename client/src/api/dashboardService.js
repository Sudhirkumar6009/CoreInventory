import api from './axiosInstance'

export const dashboardService = {
  getKpis:              () => api.get('/dashboard/kpis'),
  getOperationsSummary: () => api.get('/dashboard/operations-summary'),
  getAlerts:            () => api.get('/dashboard/alerts'),
}

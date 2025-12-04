import axios from 'axios'
import type { LogEntry, DashboardStats, FilterParams, PaginatedResponse } from '../types'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const auth = localStorage.getItem('auth')
  if (auth) {
    config.headers.Authorization = `Basic ${auth}`
  }
  return config
})

export const logApi = {
  getLogs: async (params: FilterParams): Promise<PaginatedResponse<LogEntry>> => {
    const response = await api.get('/logs', { params })
    return response.data
  },

  getLog: async (id: string): Promise<LogEntry> => {
    const response = await api.get(`/logs/${id}`)
    return response.data
  },

  getStats: async (): Promise<DashboardStats> => {
    const response = await api.get('/stats')
    return response.data
  },

  getModules: async (): Promise<string[]> => {
    const response = await api.get('/modules')
    return response.data
  },

  getEndpoints: async (): Promise<string[]> => {
    const response = await api.get('/endpoints')
    return response.data
  },
}

export default api

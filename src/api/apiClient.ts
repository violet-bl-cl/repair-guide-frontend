import axios from 'axios'

export const apiClient = axios.create({
  baseURL: 'https://repair-guide-backend.vercel.app',
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token =
    localStorage.getItem('accessToken') ||
    localStorage.getItem('orderup_token') ||
    localStorage.getItem('orderup_admin_token') ||
    localStorage.getItem('drinkhub_token') ||
    localStorage.getItem('drinkhub_admin_token');
  const tenantId =
    localStorage.getItem('tenantId') ||
    localStorage.getItem('businessUuid') ||
    localStorage.getItem('orderup_business_uuid') ||
    localStorage.getItem('drinkhub_business_uuid');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (tenantId) {
    config.headers['X-Tenant-ID'] = tenantId;
    config.headers['X-Business-Uuid'] = tenantId;
    config.headers['X-Club-Uuid'] = tenantId;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('orderup:unauthorized'));
        window.dispatchEvent(new CustomEvent('drinkhub:unauthorized'));
      }
    }
    return Promise.reject(error);
  }
);

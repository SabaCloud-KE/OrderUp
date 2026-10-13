export type ApiTarget = 'local' | 'cloud';

export const LOCAL_API_URL = 'http://localhost:5000/api/v1';
export const CLOUD_API_URL = 'https://orderup-ke.onrender.com/api/v1';

export const getApiTarget = (): ApiTarget => {
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'cloud';
  }
  const stored = (localStorage.getItem('orderup_api_target') || localStorage.getItem('drinkhub_api_target')) as ApiTarget | null;
  if (stored === 'local' || stored === 'cloud') {
    return stored;
  }
  const envUrl = (import.meta as any).env?.VITE_API_URL || '';
  if (envUrl.includes('onrender.com')) {
    return 'cloud';
  }
  return 'local';
};

export const setApiTarget = (target: ApiTarget): void => {
  localStorage.setItem('orderup_api_target', target);
};

export const getApiBaseUrl = (): string => {
  const envUrl = ((import.meta.env?.VITE_API_URL || (import.meta as any).env?.VITE_API_URL) || '').trim();
  if (envUrl) {
    return envUrl;
  }
  const target = getApiTarget();
  if (target === 'cloud') {
    return CLOUD_API_URL;
  }
  return LOCAL_API_URL;
};

export const getSocketUrl = (): string => {
  const envUrl = ((import.meta.env?.VITE_SOCKET_URL || (import.meta as any).env?.VITE_SOCKET_URL) || '').trim();
  if (envUrl) {
    return envUrl;
  }
  const base = getApiBaseUrl();
  return base.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
};

export const getApiUrl = (endpoint: string = ''): string => {
  let baseUrl = getApiBaseUrl();
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }
  if (!baseUrl.includes('/api/v1')) {
    baseUrl = `${baseUrl}/api/v1`;
  }
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
};

export const resolveImageUrl = (url?: string | null): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    if (url.startsWith('http://') && (url.includes('onrender.com') || (typeof window !== 'undefined' && window.location.protocol === 'https:'))) {
      return url.replace('http://', 'https://');
    }
    return url;
  }
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  const base = getApiBaseUrl().replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
  return `${base}${cleanPath}`;
};


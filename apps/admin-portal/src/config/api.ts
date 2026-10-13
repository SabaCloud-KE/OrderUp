export const getApiUrl = (endpoint: string = ''): string => {
  const envUrl = import.meta.env?.VITE_API_URL || (import.meta as any).env?.VITE_API_URL;
  let baseUrl = envUrl ? envUrl.trim() : 'http://localhost:5000/api/v1';
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
    return url;
  }
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  const envUrl = import.meta.env?.VITE_API_URL || (import.meta as any).env?.VITE_API_URL;
  let base = envUrl ? envUrl.trim() : 'http://localhost:5000';
  base = base.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
  return `${base}${cleanPath}`;
};

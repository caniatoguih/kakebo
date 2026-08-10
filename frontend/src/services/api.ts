import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3000/api'),
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const mutation = !['get', 'head', 'options'].includes(config.method?.toLowerCase() ?? 'get');
  if (mutation && !navigator.onLine) {
    window.dispatchEvent(new CustomEvent('kakebo:feedback', { detail: { message: 'Conecte-se à internet para concluir esta alteração.', type: 'warning' } }));
    return Promise.reject(new axios.CanceledError('Operação indisponível offline.'));
  }
  if (mutation) {
    const csrf = document.cookie.split('; ').find((cookie) => cookie.startsWith('kakebo_csrf='))?.split('=')[1];
    if (csrf) config.headers['X-CSRF-Token'] = decodeURIComponent(csrf);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const requestUrl = String(error.config?.url ?? '');
      if (!requestUrl.includes('/auth/')) sessionStorage.setItem('kakebo:session-expired', 'true');
      window.dispatchEvent(new Event('kakebo:unauthorized'));
    }
    return Promise.reject(error);
  }
);

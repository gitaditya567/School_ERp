import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('erp_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (error) => {
    const res = error.response;
    if (res?.status === 401 && !String(res.config?.url).includes('/auth/login')) {
      localStorage.removeItem('erp_token');
      if (!window.location.pathname.startsWith('/login')) window.location.replace('/login');
    }
    const err = new Error(res?.data?.message || 'The server could not be reached. Is the API running?');
    err.status = res?.status;
    err.details = res?.data?.details;
    return Promise.reject(err);
  },
);

export default api;

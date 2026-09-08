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

// In-memory cache for ultra-fast navigation between tabs
const memoryCache = new Map();
const CACHE_TTL = 30 * 1000; // 30 seconds

export const cachedGet = async (url, params = {}) => {
  const key = `${url}?${JSON.stringify(params)}`;
  const hit = memoryCache.get(key);
  if (hit && Date.now() - hit.t < CACHE_TTL) {
    return hit.data;
  }
  const data = await api.get(url, { params });
  memoryCache.set(key, { data, t: Date.now() });
  return data;
};

export const clearApiCache = (urlPrefix) => {
  if (!urlPrefix) {
    memoryCache.clear();
    return;
  }
  for (const k of memoryCache.keys()) {
    if (k.startsWith(urlPrefix)) memoryCache.delete(k);
  }
};

export default api;

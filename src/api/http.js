import axios from 'axios';

export const TOKEN_KEY = 'tg_token';

// Адрес backend: задаётся переменной VITE_API_URL, по умолчанию — Render
// Принимаем адрес с /api или без него и со слэшем в конце: /api добавляется ниже один раз
const API_URL = (import.meta.env.VITE_API_URL || 'https://telegram-copy-backend.onrender.com')
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

// Render на бесплатном тарифе «просыпается» до минуты, поэтому таймаут большой
export const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 90000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Приводим ошибки axios к той же форме, что ждут компоненты и переводы: status, code, params
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const response = error.response;
    const data = response?.data ?? {};
    const normalized = new Error(data.message || error.message || 'Server error');
    normalized.status = response?.status;
    normalized.code = response ? data.code ?? 'server' : 'network';
    normalized.params = data.params;
    return Promise.reject(normalized);
  }
);

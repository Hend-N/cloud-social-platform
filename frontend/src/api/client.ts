import axios from "axios";
import { getToken } from "../auth/token";

// Every gateway route lives under /api. Accept either "/api" (use the Vite
// proxy) or an absolute gateway URL, with or without the /api suffix:
//   /api                      -> /api
//   http://localhost:8000     -> http://localhost:8000/api
//   http://localhost:8000/api -> http://localhost:8000/api
function resolveBaseUrl(): string {
  const raw = String(import.meta.env.VITE_API_BASE_URL ?? "")
    .trim()
    .replace(/\/+$/, "");
  if (!raw) return "/api";
  if (/^https?:\/\//i.test(raw) && !/\/api$/i.test(raw)) return `${raw}/api`;
  return raw;
}

export const API_BASE_URL = resolveBaseUrl();

if (import.meta.env.DEV) {
  console.info("[api] base URL:", API_BASE_URL);
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e.response?.status === 401) {
      /* Keep token until caller decides; protected routes handle navigation. */
    }
    return Promise.reject(e);
  },
);
export default api;

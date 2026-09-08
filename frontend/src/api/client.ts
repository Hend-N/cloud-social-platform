import axios from "axios";
import { getToken } from "../auth/token";
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
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

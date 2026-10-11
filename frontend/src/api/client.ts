import axios from "axios";
import { getToken } from "../auth/token";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 15000,
});

api.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e.response?.status === 401) {
      // Protected routes handle navigation
    }
    return Promise.reject(e);
  }
);

export default api;

import api from "./client";
import { setToken } from "../auth/token";
export interface LoginCredentials {
  identifier: string;
  password: string;
}
export interface RegisterParams {
  username: string;
  email?: string;
  password: string;
}
export async function register(data: RegisterParams) {
  await api.post("/auth/register", data);
}
export async function login(credentials: LoginCredentials) {
  const r = await api.post("/auth/login", credentials);
  if (!r.data?.access_token)
    throw new Error("Login succeeded but no access token was returned.");
  setToken(r.data.access_token);
  return r.data;
}
export async function getMe() {
  return (await api.get("/auth/me")).data;
}

import { api } from "./client";

export type RegisterPayload = {
  email: string;
  password: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type LoginResponse = {
  access_token: string;
};

export async function registerUser(payload: RegisterPayload) {
  const response = await api.post("/api/auth/register", payload);
  return response.data;
}

export async function loginUser(payload: LoginPayload) {
  const response = await api.post<LoginResponse>("/api/auth/login", payload);
  return response.data;
}

export async function getMe() {
  const response = await api.get("/api/auth/me");
  return response.data;
}

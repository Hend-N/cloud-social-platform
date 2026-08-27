import api from "./client";
import { setToken } from "../auth/token";

export type RegisterData = {
  username: string;
  email: string;
  password: string;
};

export type LoginCredentials = {
  identifier: string;
  password: string;
};

export interface RegisterParams {
  username: string;
  email?: string;
  password: string;
}

export async function register(
  data: RegisterParams
): Promise<void> {
  await api.post("/auth/register", data);
}

export async function login(
  credentials: LoginCredentials
) {
  const response = await api.post("/auth/login", {
    identifier: credentials.identifier,
    password: credentials.password,
  });

  const token = response.data.access_token;

  if (!token) {
    throw new Error("Login succeeded but no access token was returned.");
  }

  setToken(token);

  return response.data;
}

export async function getMe() {
  const response = await api.get("/auth/me");

  return response.data;
}
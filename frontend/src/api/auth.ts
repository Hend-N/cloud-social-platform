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

export async function register(data: RegisterParams): Promise<void> {
  const res = await fetch("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    let message = "";

    if (typeof errorData.detail === "string") {
      message = errorData.detail;
    } else if (Array.isArray(errorData.detail) && errorData.detail[0]?.msg) {
      message = errorData.detail[0].msg;
    } else if (typeof errorData.message === "string") {
      message = errorData.message;
    } else if (typeof errorData.error === "string") {
      message = errorData.error;
    }

    throw new Error(message || `Registration failed (HTTP ${res.status}).`);
  }
}

export async function login(credentials: LoginCredentials) {
  const response = await api.post("/auth/login", {
    identifier: credentials.identifier,
    password: credentials.password,
  });

  const token = response.data.access_token;
  if (token) {
    setToken(token);
  }

  return response.data;
}


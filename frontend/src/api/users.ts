import { api } from "./client";

export type ProfilePayload = {
  username: string;
  display_name: string;
  bio: string;
};

export type Profile = {
  id?: number;
  user_id?: number;
  username: string;
  display_name: string;
  bio: string;
};

export async function createMyProfile(payload: ProfilePayload) {
  const response = await api.post<Profile>("/api/users/me", payload);
  return response.data;
}

export async function updateMyProfile(payload: ProfilePayload) {
  const response = await api.put<Profile>("/api/users/me", payload);
  return response.data;
}

export async function getPublicProfile(username: string) {
  const response = await api.get<Profile>(`/api/users/${username}`);
  return response.data;
}

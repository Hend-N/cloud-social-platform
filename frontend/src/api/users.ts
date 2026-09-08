import api from "./client";
import type { Profile, ProfileCreate } from "../types/user";
export type { Profile, ProfileCreate };
export const createMyProfile = async (data: ProfileCreate) =>
  (await api.post<Profile>("/profiles/me", data)).data;
export const getMyProfile = async () =>
  (await api.get<Profile>("/profiles/me")).data;
export const getPublicProfile = async (username: string) =>
  (await api.get<Profile>(`/profiles/${encodeURIComponent(username)}`)).data;
export const getPublicProfileByUserId = async (userId: number) =>
  (await api.get<Profile>(`/profiles/user/${userId}`)).data;
export const updateMyProfile = async (data: Partial<ProfileCreate>) =>
  (await api.put<Profile>("/profiles/me", data)).data;
export const deleteMyProfile = async () =>
  (await api.delete("/profiles/me")).data;
export const searchUsers = async (query: string) =>
  (await api.get<Profile[]>("/profiles/search", { params: { q: query } })).data;
export async function uploadMyAvatar(file: File) {
  const f = new FormData();
  f.append("avatar", file);
  return (await api.post<Profile>("/profiles/me/avatar", f)).data;
}

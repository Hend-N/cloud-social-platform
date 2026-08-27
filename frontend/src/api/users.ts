import { api } from "./client";

export interface Profile {
  id?: number;
  user_id?: number;
  username?: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
}

export interface ProfileCreate {
  username: string;
  display_name: string;
  bio?: string;
}

export async function createMyProfile(
  data: ProfileCreate
): Promise<Profile> {
  const response = await api.post<Profile>(
    "/profiles/me",
    data
  );

  return response.data;
}

export async function getMyProfile(): Promise<Profile> {
  const response = await api.get<Profile>(
    "/profiles/me"
  );

  return response.data;
}

export async function getPublicProfile(
  username: string
): Promise<Profile> {
  const response = await api.get<Profile>(
    `/profiles/${username}`
  );

  return response.data;
}

export async function getPublicProfileByUserId(
  userId: number
): Promise<Profile> {
  const response = await api.get<Profile>(
    `/profiles/user/${userId}`
  );

  return response.data;
}

export async function updateMyProfile(
  data: Partial<ProfileCreate>
): Promise<Profile> {
  const response = await api.put<Profile>(
    "/profiles/me",
    data
  );

  return response.data;
}

export async function deleteMyProfile() {
  const response = await api.delete(
    "/profiles/me"
  );

  return response.data;
}

export async function searchUsers(
  query: string
): Promise<Profile[]> {
  const response = await api.get<Profile[]>(
    "/profiles/search",
    {
      params: { q: query },
    }
  );

  return response.data;
}

export async function uploadMyAvatar(file: File): Promise<Profile> {
  const formData = new FormData();

  formData.append("avatar", file);

  const response = await api.post<Profile>(
    "/profiles/me/avatar",
    formData
  );

  return response.data;
}
import api from "./client";

export type Profile = {
  id: number;
  user_id: number;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
};

export type UpdateProfileData = {
  display_name?: string;
  bio?: string;
};

export async function getMyProfile(): Promise<Profile> {
  const response = await api.get<Profile>("/profiles/me");
  return response.data;
}

export async function updateProfile(data: UpdateProfileData): Promise<Profile> {
  const response = await api.put<Profile>("/profiles/me", data);
  return response.data;
}

export async function uploadAvatar(file: File): Promise<Profile> {
  const formData = new FormData();
  formData.append("avatar", file);

  const response = await api.post<Profile>(
    "/profiles/me/avatar",
    formData
  );

  return response.data;
}
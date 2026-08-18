import api from "./client";

export type Profile = {
  id: number;
  user_id: number;
  username: string;
  display_name: string;
  bio: string;
  avatar_url?: string;
};

export type CreateProfileData = {
  display_name: string;
  bio?: string;
};

export type UpdateProfileData = {
  display_name?: string;
  bio?: string;
};

export async function getMyProfile(): Promise<Profile> {
  const response = await api.get<Profile>("/profiles/me");
  return response.data;
}

export async function getPublicProfile(username: string): Promise<Profile> {
  const response = await api.get<Profile>(`/profiles/${username}`);
  return response.data;
}

export async function createMyProfile(data: CreateProfileData): Promise<Profile> {
  const response = await api.post<Profile>("/profiles/me", data);
  return response.data;
}

export async function updateMyProfile(data: UpdateProfileData): Promise<Profile> {
  const response = await api.put<Profile>("/profiles/me", data);
  return response.data;
}

export async function uploadMyAvatar(file: File): Promise<Profile> {
  const formData = new FormData();
  formData.append("avatar", file);

  const response = await api.post<Profile>("/profiles/me/avatar", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
}

export interface FollowStats {
  followers_count: number;
  following_count: number;
}

export async function getFollowStats(username: string): Promise<FollowStats> {
  const res = await fetch(`/users/${username}/stats`);
  if (!res.ok) {
    throw new Error("Failed to fetch follow stats");
  }
  return res.json();
}

export async function searchUsers(query: string): Promise<Profile[]> {
  const cleanQuery = query.toLowerCase().replace(/^@/, "").trim();
  if (!cleanQuery) return [];

  try {
    const res = await fetch(`/users/search?q=${encodeURIComponent(cleanQuery)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch {

  }
  try {
    const res = await fetch("/users");
    if (!res.ok) return [];

    const allUsers: Profile[] = await res.json();
    return allUsers.filter((u) => {
      const matchUsername = u.username?.toLowerCase().includes(cleanQuery);
      const matchDisplayName = u.display_name?.toLowerCase().includes(cleanQuery);
      return matchUsername || matchDisplayName;
    });
  } catch {
    return [];
  }
}
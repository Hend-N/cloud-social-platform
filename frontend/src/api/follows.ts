import { api } from "./client";

export interface FollowStats {
  followers_count: number;
  following_count: number;
}

export async function followUser(userId: number) {
  const response = await api.post(`/follows/${userId}`);
  return response.data;
}

export async function unfollowUser(userId: number) {
  const response = await api.delete(`/follows/${userId}`);
  return response.data;
}

export async function checkFollowStatus(userId: number) {
  const response = await api.get<{ is_following: boolean }>(
    `/follows/${userId}/status`
  );

  return response.data;
}

export async function getFollowStats(
  userId: number
): Promise<FollowStats> {
  const response = await api.get<FollowStats>(
    `/follows/${userId}/stats`
  );

  return response.data;
}
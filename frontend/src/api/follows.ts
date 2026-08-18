import { api } from "./client";

export type FollowResponse = {
  following?: boolean;
  message?: string;
};

export async function followUser(targetUserId: number) {
  const response = await api.post<FollowResponse>("/follows", {
    target_user_id: targetUserId,
  });

  return response.data;
}

export async function unfollowUser(targetUserId: number) {
  const response = await api.delete<FollowResponse>(
    `/follows/${targetUserId}`
  );

  return response.data;
}

export async function getFollowers(userId: number) {
  const response = await api.get(`/follows/users/${userId}/followers`);
  return response.data;
}

export async function getFollowing(userId: number) {
  const response = await api.get(`/follows/users/${userId}/following`);
  return response.data;
}

export async function checkFollowStatus(targetUserId: number) {
  const response = await api.get(`/follows/status/${targetUserId}`);
  return response.data; 
}

export interface FollowStats {
  followers_count: number;
  following_count: number;
}

export async function getFollowStats(userId: number): Promise<FollowStats> {
  const response = await api.get(`/follows/users/${userId}/stats`);
  return response.data;
}
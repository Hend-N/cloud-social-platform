import { api } from "./client";

export type FollowResponse = {
  following?: boolean;
  message?: string;
};

export async function followUser(targetUserId: number) {
  const response = await api.post<FollowResponse>("/api/follows", {
    target_user_id: targetUserId,
  });

  return response.data;
}

export async function unfollowUser(targetUserId: number) {
  const response = await api.delete<FollowResponse>(
    `/api/follows/${targetUserId}`
  );

  return response.data;
}

export async function getFollowers(userId: number) {
  const response = await api.get(`/api/follows/users/${userId}/followers`);
  return response.data;
}

export async function getFollowing(userId: number) {
  const response = await api.get(`/api/follows/users/${userId}/following`);
  return response.data;
}

import api from "./client";
import type { FollowStats } from "../types/follow";
export type { FollowStats };

export const followUser = async (id: number) =>
  (await api.post(`/follows`, { target_user_id: id })).data;

export const unfollowUser = async (id: number) =>
  (await api.delete(`/follows/${id}`)).data;

export async function checkFollowStatus(id: number) {
  try {
    return (await api.get<{ is_following: boolean }>(`/follows/status/${id}`))
      .data;
  } catch {
    return { is_following: false };
  }
}

export async function getFollowStats(id: number): Promise<FollowStats> {
  try {
    return (await api.get<FollowStats>(`/follows/users/${id}/stats`)).data;
  } catch {
    return { followers_count: 0, following_count: 0 };
  }
}

export async function getFollowers(userId: number): Promise<number[]> {
  try {
    const d = (await api.get(`/follows/users/${userId}/followers`)).data;
    return Array.isArray(d?.followers)
      ? d.followers.map((x: any) => x.follower_id).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

export async function getFollowing(userId: number): Promise<number[]> {
  try {
    const d = (await api.get(`/follows/users/${userId}/following`)).data;
    return Array.isArray(d?.following)
      ? d.following.map((x: any) => x.following_id).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

import api from "./client";
import type { FollowStats } from "../types/follow";
export type { FollowStats };
export const followUser = async (id: number) =>
  (await api.post(`/follows/${id}`)).data;
export const unfollowUser = async (id: number) =>
  (await api.delete(`/follows/${id}`)).data;
export async function checkFollowStatus(id: number) {
  try {
    return (await api.get<{ is_following: boolean }>(`/follows/${id}/status`))
      .data;
  } catch {
    return { is_following: false };
  }
}
export async function getFollowStats(id: number): Promise<FollowStats> {
  try {
    return (await api.get<FollowStats>(`/follows/${id}/stats`)).data;
  } catch {
    try {
      return (await api.get<FollowStats>(`/follows/user/${id}/stats`)).data;
    } catch {
      return { followers_count: 0, following_count: 0 };
    }
  }
}
// Reserved until follower-list endpoints are added to the follow service.
export async function getFollowers(_userId: number) {
  return [] as unknown[];
}
export async function getFollowing(_userId: number) {
  return [] as unknown[];
}

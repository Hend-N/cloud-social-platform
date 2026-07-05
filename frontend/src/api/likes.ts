import { api } from "./client";

export async function likePost(postId: number) {
  const response = await api.post(`/api/likes/posts/${postId}`);
  return response.data;
}

export async function unlikePost(postId: number) {
  const response = await api.delete(`/api/likes/posts/${postId}`);
  return response.data;
}

export async function getLikeCount(postId: number) {
  const response = await api.get(`/api/likes/posts/${postId}/count`);

  const data = response.data;

  if (typeof data === "number") {
    return data;
  }

  if (typeof data.count === "number") {
    return data.count;
  }

  if (typeof data.like_count === "number") {
    return data.like_count;
  }

  if (typeof data.likes_count === "number") {
    return data.likes_count;
  }

  return 0;
}


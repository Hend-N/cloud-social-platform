import api from "./client";
import type { Post } from "../types/post";
export type { Post };
export async function getPosts() {
  const r = await api.get<Post[]>("/posts");
  return Array.isArray(r.data) ? r.data : [];
}
export async function getUserPosts(username: string, userId?: number) {
  try {
    return (
      await api.get<Post[]>(`/posts/user/${encodeURIComponent(username)}`)
    ).data;
  } catch {
    if (userId)
      try {
        return (await api.get<Post[]>(`/posts/user/${userId}`)).data;
      } catch {}
    const all = await getPosts();
    return all.filter(
      (p) =>
        (username && p.username?.toLowerCase() === username.toLowerCase()) ||
        (userId && p.user_id === userId),
    );
  }
}
export const getPostsByUser = getUserPosts;
export async function createPost(content: string) {
  return (await api.post<Post>("/posts/me", { content })).data;
}
export async function updatePost(postId: number, content: string) {
  return (await api.put<Post>(`/posts/${postId}`, { content })).data;
}
export async function deletePost(postId: number) {
  await api.delete(`/posts/${postId}`);
}

import api from "./client";
import type { Post } from "../types/post";
export type { Post };
export async function getPosts() {
  const r = await api.get<Post[]>("/posts");
  return Array.isArray(r.data) ? r.data : [];
}
export async function getUserPosts(username: string, userId?: number) {
  if (userId) {
    try {
      return (await api.get<Post[]>(`/posts/user/${userId}`)).data;
    } catch {
      // fall through to client-side filtering below
    }
  }
  // Fallback for when we only have a username (no resolved user id yet):
  // filter the enriched global feed, which carries `username` on each post.
  const all = await getPosts();
  return all.filter(
    (p) =>
      (username && p.username?.toLowerCase() === username.toLowerCase()) ||
      (userId && p.user_id === userId),
  );
}
export const getPostsByUser = getUserPosts;
export async function createPost(content: string) {
  return (await api.post<Post>("/posts/me", { content })).data;
}
export async function getMyPosts() {
  return (await api.get<Post[]>("/posts/me")).data;
}
export async function updatePost(postId: number, content: string) {
  return (await api.put<Post>(`/posts/${postId}`, { content })).data;
}
export async function deletePost(postId: number) {
  await api.delete(`/posts/${postId}`);
}

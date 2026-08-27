import { api } from "./client";

export interface Post {
  id?: number;
  post_id?: number;
  user_id?: number;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  content: string;
  created_at?: string;
}

export async function getPosts(): Promise<Post[]> {
  const response = await api.get<Post[]>("/posts");
  return response.data;
}

export async function getUserPosts(username: string): Promise<Post[]> {
  try {
    const response = await api.get<Post[]>(`/posts/user/${username}`);
    return response.data;
  } catch {
    const allPosts = await getPosts();
    return allPosts.filter(
      (post) => post.username?.toLowerCase() === username.toLowerCase()
    );
  }
}
export const getPostsByUser = getUserPosts;

export async function deletePost(postId: number): Promise<void> {
  await api.delete(`/posts/${postId}`);
}

export async function createPost(content: string): Promise<Post> {
  const response = await api.post<Post>("/posts", { content });
  return response.data;
}
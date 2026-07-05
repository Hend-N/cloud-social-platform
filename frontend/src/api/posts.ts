import { api } from "./client";

export type Post = {
  id?: number;
  post_id?: number;
  user_id?: number;
  content: string;
  created_at?: string;
};

export async function getPosts() {
  const response = await api.get<Post[] | { posts: Post[] }>("/api/posts");

  if (Array.isArray(response.data)) {
    return response.data;
  }

  if (Array.isArray(response.data.posts)) {
    return response.data.posts;
  }

  return [];
}

export async function createPost(content: string) {
  const response = await api.post<Post>("/api/posts/me", {
    content,
  });

  return response.data;
}
import { api } from "./client";

export interface Comment {
  id?: number;
  comment_id?: number;
  post_id?: number;
  user_id?: number;
  content: string;
  created_at?: string;
}

export async function getCommentsForPost(postId: number) {
  const response = await api.get<Comment[] | { comments: Comment[] }>(
    `/comments/post/${postId}`
  );

  if (Array.isArray(response.data)) {
    return response.data;
  }

  if (Array.isArray(response.data.comments)) {
    return response.data.comments;
  }

  return [];
}

export async function createComment(postId: number, comment: string) {
  const response = await api.post<Comment>("/comments", {
    post_id: postId,
    comment,
  });

  return response.data;
}

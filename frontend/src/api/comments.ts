import { api } from "./client";

export type Comment = {
  id?: number;
  comment_id?: number;
  user_id?: number;
  post_id: number;
  comment: string;
  created_at?: string;
};

export async function getCommentsForPost(postId: number) {
  const response = await api.get<Comment[] | { comments: Comment[] }>(
    `/api/comments/post/${postId}`
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
  const response = await api.post<Comment>("/api/comments", {
    post_id: postId,
    comment,
  });

  return response.data;
}

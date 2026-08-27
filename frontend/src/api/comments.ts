import { api } from "./client";

export interface Comment {
  id: number;
  post_id?: number;
  user_id: number;
  comment: string;
  username?: string;
  created_at?: string;
}

export async function getCommentsForPost(
  postId: number
): Promise<Comment[]> {
  const response = await api.get<
    Comment[] | { comments: Comment[] }
  >(`/comments/post/${postId}`);

  if (Array.isArray(response.data)) {
    return response.data;
  }

  if (Array.isArray(response.data.comments)) {
    return response.data.comments;
  }

  return [];
}

export async function createComment(
  postId: number,
  content: string
): Promise<Comment> {
  const response = await api.post<Comment>(
    "/comments",
    {
      post_id: postId,
      comment: content,
    }
  );

  return response.data;
}
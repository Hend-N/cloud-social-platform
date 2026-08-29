import { api } from "./client";

export interface Comment {
  id: number;
  post_id: number;
  user_id: number;
  parent_comment_id: number | null;
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
  content: string,
  parentCommentId?: number
): Promise<Comment> {
  const response = await api.post<Comment>(
    "/comments",
    {
      post_id: postId,
      comment: content,
      parent_comment_id:
        parentCommentId ?? null,
    }
  );

  return response.data;
}

export async function updateComment(
  commentId: number,
  content: string
): Promise<Comment> {
  const response = await api.put<Comment>(
    `/comments/${commentId}`,
    {
      comment: content,
    }
  );

  return response.data;
}

export async function deleteComment(
  commentId: number
): Promise<void> {
  await api.delete(
    `/comments/${commentId}`
  );
}
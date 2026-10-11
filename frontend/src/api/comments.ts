import api from "./client";
import type { Comment } from "../types/comment";
export type { Comment };
const normalize = (d: any): Comment[] =>
  Array.isArray(d) ? d : Array.isArray(d?.comments) ? d.comments : [];
export async function getCommentsForPost(postId: number) {
  return normalize((await api.get(`/comments/post/${postId}`)).data);
}
export async function getMyComments() {
  try {
    return normalize((await api.get("/comments/user/me")).data);
  } catch {
    return [];
  }
}
export async function createComment(
  postId: number,
  content: string,
  parentCommentId?: number,
) {
  return (
    await api.post<Comment>("/comments", {
      post_id: postId,
      comment: content,
      parent_comment_id: parentCommentId ?? null,
    })
  ).data;
}
export async function updateComment(id: number, content: string) {
  return (await api.put<Comment>(`/comments/${id}`, { comment: content })).data;
}
// The backend deletes a comment together with all of its replies and
// returns every deleted id, so callers can drop the whole branch from state.
export async function deleteComment(id: number): Promise<number[]> {
  const data = (await api.delete(`/comments/${id}`)).data;
  return Array.isArray(data?.deleted_ids) ? data.deleted_ids : [id];
}
// Reserved for a future dedicated replies endpoint. Intentionally no network call.
export async function getMyReplies(): Promise<Comment[]> {
  return [];
}

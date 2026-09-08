import api from "./client";
import type { CommentReaction, CommentReactionCount } from "../types/like";
export type { CommentReaction, CommentReactionCount };
export const likePost = async (id: number) =>
  (await api.post(`/likes/posts/${id}`)).data;
export const unlikePost = async (id: number) =>
  (await api.delete(`/likes/posts/${id}`)).data;
export async function getLikeCount(id: number) {
  const d = (await api.get(`/likes/posts/${id}/count`)).data;
  return d?.like_count ?? d?.count ?? 0;
}
export async function getMyLikedPostIds() {
  try {
    const d = (await api.get("/likes/me")).data;
    return Array.isArray(d?.likes)
      ? d.likes.map((x: any) => x.post_id).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}
export async function getMyLikedCommentIds() {
  try {
    const d = (await api.get("/likes/comments/me")).data;
    return Array.isArray(d?.likes)
      ? d.likes.map((x: any) => x.comment_id).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}
export async function likeComment(id: number) {
  return (await api.post(`/likes/comments/${id}`)).data;
}
export async function dislikeComment(id: number) {
  return (await api.post(`/likes/comments/${id}/dislike`)).data;
}
export async function removeCommentReaction(id: number) {
  return (await api.delete(`/likes/comments/${id}`)).data;
}
export async function getCommentReactionCount(
  id: number,
): Promise<CommentReactionCount> {
  return (await api.get(`/likes/comments/${id}/count`)).data;
}
export async function getMyCommentReaction(
  id: number,
): Promise<CommentReaction> {
  return (
    (await api.get(`/likes/comments/${id}/reaction`)).data?.reaction ?? null
  );
}
// Reserved batch endpoint; safe no-op until backend contract is finalized.
export async function getBatchCommentReactions(
  ids: number[],
): Promise<Record<number, CommentReaction>> {
  if (!ids.length) return {};
  try {
    return (
      (await api.post("/likes/comments/batch-reactions", ids)).data
        ?.reactions ?? {}
    );
  } catch {
    return {};
  }
}

export type CommentReaction = "like" | "dislike" | null;
export interface CommentReactionCount {
  comment_id: number;
  like_count: number;
  dislike_count: number;
}

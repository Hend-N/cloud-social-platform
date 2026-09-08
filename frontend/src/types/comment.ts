export interface Comment {
  id: number;
  post_id: number;
  user_id: number;
  parent_comment_id: number | null;
  comment: string;
  username?: string;
  created_at?: string;
}

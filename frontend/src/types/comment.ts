export interface Comment {
  id: number;
  post_id: number;
  user_id: number;
  parent_comment_id: number | null;
  comment: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  created_at?: string;
}

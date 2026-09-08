import type { Post } from "../../types/post";
import type { Comment } from "../../types/comment";
import { PostList } from "../posts/PostList";
export function ProfileLikes({
  posts,
  likes,
  comments,
  loggedIn,
  onComment,
}: {
  posts: Post[];
  likes: Record<number, number>;
  comments: Record<number, Comment[]>;
  loggedIn: boolean;
  onComment: (id: number, text: string, parent?: number) => Promise<void>;
}) {
  return (
    <PostList
      posts={posts}
      likes={likes}
      comments={comments}
      loggedIn={loggedIn}
      onComment={onComment}
    />
  );
}

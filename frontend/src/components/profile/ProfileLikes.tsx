import type { Post } from "../../types/post";
import { PostList } from "../posts/PostList";

export function ProfileLikes({
  posts,
  onDeleted,
  onUpdated,
}: {
  posts: Post[];
  onDeleted?: (postId: number) => void;
  onUpdated?: (post: Post) => void;
}) {
  return (
    <PostList
      posts={posts}
      likedPostIds={posts.map((p) => (p.post_id ?? p.id) as number)}
      onDeleted={onDeleted}
      onUpdated={onUpdated}
      emptyTitle="No liked posts yet"
      emptyDescription="Posts you like will appear here."
    />
  );
}

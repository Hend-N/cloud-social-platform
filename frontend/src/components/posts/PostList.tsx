import type { Post } from "../../types/post";
import { PostCard } from "./PostCard";
import { EmptyState } from "../ui/EmptyState";

export function PostList({
  posts,
  likedPostIds = [],
  onDeleted,
  onUpdated,
  emptyTitle = "No posts yet",
  emptyDescription = "Posts will appear here when someone shares an update.",
}: {
  posts: Post[];
  likedPostIds?: number[];
  onDeleted?: (postId: number) => void;
  onUpdated?: (post: Post) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (!posts.length)
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return (
    <div className="post-list">
      {posts.map((p) => {
        const id = p.post_id ?? p.id;
        if (!id) return null;
        return (
          <PostCard
            key={id}
            post={p}
            likedByMe={likedPostIds.includes(id)}
            onDeleted={onDeleted}
            onUpdated={onUpdated}
          />
        );
      })}
    </div>
  );
}

import type { Post } from "../../types/post";
import type { Comment } from "../../types/comment";
import { PostCard } from "./PostCard";
import { EmptyState } from "../ui/EmptyState";
export function PostList({
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
  if (!posts.length)
    return (
      <EmptyState
        title="No posts yet"
        description="Posts will appear here when someone shares an update."
      />
    );
  return (
    <div className="post-list">
      {posts.map((p) => {
        const id = p.post_id ?? p.id;
        if (!id) return null;
        return (
          <PostCard
            key={id}
            post={p}
            likeCount={likes[id] ?? 0}
            comments={comments[id] ?? []}
            loggedIn={loggedIn}
            onComment={onComment}
          />
        );
      })}
    </div>
  );
}

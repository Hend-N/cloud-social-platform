import type { Comment } from "../../types/comment";
import { EmptyState } from "../ui/EmptyState";
export function ProfileComments({ comments }: { comments: Comment[] }) {
  return comments.length ? (
    <div className="activity-list">
      {comments.map((c) => (
        <article key={c.id}>
          <span>Comment</span>
          <p>{c.comment}</p>
        </article>
      ))}
    </div>
  ) : (
    <EmptyState
      title="No comments yet"
      description="Your comments will appear here."
    />
  );
}

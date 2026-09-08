import type { Comment } from "../../types/comment";
import { EmptyState } from "../ui/EmptyState";
export function ProfileReplies({ comments }: { comments: Comment[] }) {
  return comments.length ? (
    <div className="activity-list">
      {comments.map((c) => (
        <article key={c.id}>
          <span>Reply</span>
          <p>{c.comment}</p>
        </article>
      ))}
    </div>
  ) : (
    <EmptyState
      title="No replies yet"
      description="Replies you make will appear here."
    />
  );
}

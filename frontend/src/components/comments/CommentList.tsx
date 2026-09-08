import type { Comment } from "../../types/comment";
import { CommentForm } from "./CommentForm";
import { CommentItem } from "./CommentItem";
export function CommentList({
  comments,
  loggedIn,
  onAddComment,
}: {
  comments: Comment[];
  loggedIn: boolean;
  onAddComment: (text: string, parent?: number) => Promise<void>;
}) {
  const roots = comments.filter((c) => c.parent_comment_id == null);
  return (
    <section className="comments">
      <div className="comments-title">
        Conversation <span>{comments.length}</span>
      </div>
      {loggedIn ? (
        <CommentForm onSubmit={(t) => onAddComment(t)} />
      ) : (
        <div className="login-inline">Sign in to join the conversation.</div>
      )}
      {roots.map((c) => (
        <CommentItem
          key={c.id}
          comment={c}
          replies={comments.filter((r) => r.parent_comment_id === c.id)}
          loggedIn={loggedIn}
          onReply={onAddComment}
        />
      ))}
    </section>
  );
}

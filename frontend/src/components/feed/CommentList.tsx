import { useState } from "react";
import type { FormEvent } from "react";
import type { Comment } from "../../api/comments";
import { Button } from "../ui/Button";

type CommentListProps = {
  comments: Comment[];
  loggedIn: boolean;
  onAddComment: (text: string, parentId?: number) => Promise<void>;
};

export function CommentList({ comments, loggedIn, onAddComment }: CommentListProps) {
  const [draft, setDraft] = useState("");
  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onAddComment(draft);
      setDraft("");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReplySubmit(e: FormEvent, parentId: number) {
    e.preventDefault();
    if (!replyDraft.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onAddComment(replyDraft, parentId);
      setReplyDraft("");
      setReplyingToId(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--color-border, #334155)" }}>
      <h4 style={{ margin: "0 0 12px 0", fontSize: "0.95rem" }}>Comments</h4>

      {comments.length === 0 ? (
        <p style={{ color: "var(--color-muted, #94a3b8)", fontSize: "0.875rem" }}>No comments yet.</p>
      ) : (
        <div style={{ display: "grid", gap: "8px", marginBottom: "12px" }}>
          {comments.map((comment, index) => {
            const commentId = comment.id || comment.id || index;
            const isReplying = replyingToId === commentId;

            return (
              <div
                key={commentId}
                style={{
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  background: "rgba(0,0,0,0.2)",
                }}
              >
                <p style={{ margin: "0 0 4px 0", fontSize: "0.9rem" }}>{comment.comment}</p>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <small style={{ color: "var(--color-muted, #94a3b8)" }}>
                    User ID: {comment.user_id ?? "unknown"}
                  </small>
                  {loggedIn && (
                    <button
                      type="button"
                      onClick={() => setReplyingToId(isReplying ? null : Number(commentId))}
                      style={{ background: "none", border: "none", color: "#38bdf8", cursor: "pointer", fontSize: "0.8rem" }}
                    >
                      {isReplying ? "Cancel" : "Reply"}
                    </button>
                  )}
                </div>

                {/* Reply Input Form */}
                {isReplying && (
                  <form onSubmit={(e) => handleReplySubmit(e, Number(commentId))} style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                    <input
                      type="text"
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      placeholder="Write a reply..."
                      style={{
                        flex: 1,
                        padding: "6px 10px",
                        borderRadius: "4px",
                        border: "1px solid var(--color-border, #334155)",
                        background: "rgba(15, 23, 42, 0.8)",
                        color: "inherit",
                        fontSize: "0.85rem",
                      }}
                    />
                    <Button type="submit" variant="secondary" disabled={isSubmitting || !replyDraft.trim()}>
                      Reply
                    </Button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Main Comment Input */}
      {loggedIn ? (
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: "8px" }}>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a comment..."
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid var(--color-border, #334155)",
              background: "rgba(15, 23, 42, 0.6)",
              color: "inherit",
            }}
          />
          <Button type="submit" variant="secondary" disabled={isSubmitting || !draft.trim()}>
            Comment
          </Button>
        </form>
      ) : (
        <p style={{ color: "var(--color-muted, #94a3b8)", fontSize: "0.85rem", margin: 0 }}>Log in to comment.</p>
      )}
    </section>
  );
}
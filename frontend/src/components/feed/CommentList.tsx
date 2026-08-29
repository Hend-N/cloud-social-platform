import { useState } from "react";
import type { FormEvent } from "react";

import type { Comment } from "../../api/comments";
import { Button } from "../ui/Button";

type CommentListProps = {
  comments: Comment[];
  loggedIn: boolean;

  onAddComment: (
    text: string,
    parentId?: number
  ) => Promise<void>;

  onDeleteComment?: (
    commentId: number
  ) => Promise<void>;

  currentUserId?: number;
};

export function CommentList({
  comments,
  loggedIn,
  onAddComment,
  onDeleteComment,
  currentUserId,
}: CommentListProps) {

  const [draft, setDraft] = useState("");

  const [replyingToId, setReplyingToId] =
    useState<number | null>(null);

  const [replyDraft, setReplyDraft] =
    useState("");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState<number | null>(null);

  /*
   * Find all direct children of a comment.
   */
  function getReplies(commentId: number): Comment[] {
    return comments.filter(
      (comment) =>
        comment.parent_comment_id === commentId
    );
  }

  /*
   * Submit a normal top-level comment.
   */
  async function handleSubmit(
    e: FormEvent
  ) {
    e.preventDefault();

    if (
      !draft.trim() ||
      isSubmitting
    ) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onAddComment(
        draft.trim()
      );

      setDraft("");
    } finally {
      setIsSubmitting(false);
    }
  }

  /*
   * Submit a reply to ANY comment.
   *
   * parentId is the exact comment being replied to.
   */
  async function handleReplySubmit(
    e: FormEvent,
    parentId: number
  ) {
    e.preventDefault();

    if (
      !replyDraft.trim() ||
      isSubmitting
    ) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onAddComment(
        replyDraft.trim(),
        parentId
      );

      setReplyDraft("");
      setReplyingToId(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(
    commentId: number
  ) {
    if (
      !onDeleteComment ||
      deletingId !== null
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Are you sure you want to delete this comment?"
      );

    if (!confirmed) {
      return;
    }

    setDeletingId(commentId);

    try {
      await onDeleteComment(
        commentId
      );
    } finally {
      setDeletingId(null);
    }
  }

  /*
   * Recursive comment renderer.
   *
   * This is the important part.
   *
   * Every comment gets its own Reply button.
   */
  function renderComment(
    comment: Comment,
    depth: number = 0
  ): React.ReactNode {

    const replies =
      getReplies(comment.id);

    const isReplying =
      replyingToId === comment.id;

    const isDeleting =
      deletingId === comment.id;

    return (
      <div
        key={comment.id}
        style={{
          marginLeft:
            depth === 0
              ? "0"
              : "32px",

          borderLeft:
            depth === 0
              ? "none"
              : "2px solid rgba(255,255,255,0.08)",

          paddingLeft:
            depth === 0
              ? "0"
              : "12px",

          display: "grid",
          gap: "8px",
        }}
      >

        {/* =========================
            COMMENT
            ========================= */}

        <div
          style={{
            border:
              "1px solid rgba(255,255,255,0.08)",

            padding:
              "8px 12px",

            borderRadius:
              "6px",

            background:
              depth === 0
                ? "rgba(0,0,0,0.2)"
                : "rgba(0,0,0,0.12)",
          }}
        >

          <p
            style={{
              margin:
                "0 0 4px 0",

              fontSize:
                depth === 0
                  ? "0.9rem"
                  : "0.85rem",
            }}
          >
            {comment.comment}
          </p>

          {/* =========================
              COMMENT ACTIONS
              ========================= */}

          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
            }}
          >

            <small
              style={{
                color:
                  "var(--color-muted, #94a3b8)",
              }}
            >
              User ID: {comment.user_id}
            </small>

            {loggedIn && (
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                }}
              >

                {/* REPLY */}

                <button
                  type="button"
                  onClick={() => {
                    setReplyingToId(
                      isReplying
                        ? null
                        : comment.id
                    );

                    setReplyDraft("");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#38bdf8",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                  }}
                >
                  {isReplying
                    ? "Cancel"
                    : "Reply"}
                </button>

                {/* DELETE */}

                {currentUserId ===
                  comment.user_id &&
                  onDeleteComment && (
                    <button
                      type="button"
                      disabled={
                        isDeleting
                      }
                      onClick={() =>
                        handleDelete(
                          comment.id
                        )
                      }
                      style={{
                        background:
                          "none",
                        border:
                          "none",
                        color:
                          "#ef4444",
                        cursor:
                          "pointer",
                        fontSize:
                          "0.8rem",
                      }}
                    >
                      {isDeleting
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  )}

              </div>
            )}

          </div>

          {/* =========================
              REPLY FORM
              ========================= */}

          {isReplying && (
            <form
              onSubmit={(e) =>
                handleReplySubmit(
                  e,
                  comment.id
                )
              }
              style={{
                display: "flex",
                gap: "8px",
                marginTop: "8px",
              }}
            >

              <input
                type="text"
                value={replyDraft}
                onChange={(e) =>
                  setReplyDraft(
                    e.target.value
                  )
                }
                placeholder="Write a reply..."
                maxLength={300}
                style={{
                  flex: 1,
                  padding:
                    "6px 10px",
                  borderRadius:
                    "4px",
                  border:
                    "1px solid var(--color-border, #334155)",
                  background:
                    "rgba(15, 23, 42, 0.8)",
                  color:
                    "inherit",
                  fontSize:
                    "0.85rem",
                }}
              />

              <Button
                type="submit"
                variant="secondary"
                disabled={
                  isSubmitting ||
                  !replyDraft.trim()
                }
              >
                Reply
              </Button>

            </form>
          )}

        </div>

        {/* =========================
            CHILD COMMENTS
            ========================= */}

        {replies.length > 0 && (
          <div
            style={{
              display: "grid",
              gap: "8px",
            }}
          >
            {replies.map(
              (reply) =>
                renderComment(
                  reply,
                  depth + 1
                )
            )}
          </div>
        )}

      </div>
    );
  }

  /*
   * Only comments with no parent are rendered
   * here.
   *
   * Their children are rendered recursively
   * by renderComment().
   */
  const topLevelComments =
    comments.filter(
      (comment) =>
        comment.parent_comment_id == null
    );

  return (
    <section
      style={{
        marginTop: "16px",
        paddingTop: "12px",
        borderTop:
          "1px solid var(--color-border, #334155)",
      }}
    >

      <h4
        style={{
          margin:
            "0 0 12px 0",
          fontSize:
            "0.95rem",
        }}
      >
        Comments
      </h4>

      {topLevelComments.length === 0 ? (

        <p
          style={{
            color:
              "var(--color-muted, #94a3b8)",
            fontSize:
              "0.875rem",
          }}
        >
          No comments yet.
        </p>

      ) : (

        <div
          style={{
            display: "grid",
            gap: "12px",
            marginBottom: "12px",
          }}
        >
          {topLevelComments.map(
            (comment) =>
              renderComment(comment)
          )}
        </div>

      )}

      {/* =========================
          TOP-LEVEL COMMENT FORM
          ========================= */}

      {loggedIn ? (

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            gap: "8px",
          }}
        >

          <input
            type="text"
            value={draft}
            onChange={(e) =>
              setDraft(
                e.target.value
              )
            }
            placeholder="Write a comment..."
            maxLength={300}
            style={{
              flex: 1,
              padding:
                "8px 12px",
              borderRadius:
                "6px",
              border:
                "1px solid var(--color-border, #334155)",
              background:
                "rgba(15, 23, 42, 0.6)",
              color:
                "inherit",
            }}
          />

          <Button
            type="submit"
            variant="secondary"
            disabled={
              isSubmitting ||
              !draft.trim()
            }
          >
            Comment
          </Button>

        </form>

      ) : (

        <p
          style={{
            color:
              "var(--color-muted, #94a3b8)",
            fontSize:
              "0.85rem",
            margin: 0,
          }}
        >
          Log in to comment.
        </p>

      )}

    </section>
  );
}
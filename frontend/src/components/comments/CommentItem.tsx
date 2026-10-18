import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../ui/Avatar";
import type { Comment } from "../../types/comment";
import {
  likeComment,
  dislikeComment,
  removeCommentReaction,
  getCommentReactionCount,
  getMyCommentReaction,
} from "../../api/likes";
import { getApiErrorMessage } from "../../api/errors";
import { ReplyForm } from "./ReplyForm";
import { CommentForm } from "./CommentForm";
import { KebabMenu } from "../ui/KebabMenu";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { ErrorMessage } from "../ui/ErrorMessage";

type Reaction = "like" | "dislike" | null;

export function CommentItem({
  comment,
  childrenMap,
  loggedIn,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
}: {
  comment: Comment;
  childrenMap: Map<number, Comment[]>;
  loggedIn: boolean;
  currentUserId?: number;
  onReply: (text: string, parentId: number) => Promise<void>;
  onEdit: (id: number, text: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reaction, setReaction] = useState<Reaction>(null);
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const replies = childrenMap.get(comment.id) ?? [];
  const isOwner = currentUserId != null && comment.user_id === currentUserId;
  const author = comment.display_name || comment.username || "Unknown author";

  // Counts are public; "my reaction" needs a login.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await getCommentReactionCount(comment.id);
        if (!cancelled) {
          setLikes(c.like_count || 0);
          setDislikes(c.dislike_count || 0);
        }
      } catch {
        /* counts stay at 0 */
      }
      if (loggedIn) {
        try {
          const r = await getMyCommentReaction(comment.id);
          if (!cancelled) setReaction(r);
        } catch {
          /* reaction stays empty */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [comment.id, loggedIn]);

  async function react(next: "like" | "dislike") {
    if (!loggedIn || busy) return;
    setBusy(true);
    setError("");
    try {
      if (reaction === next) {
        await removeCommentReaction(comment.id);
        setReaction(null);
      } else {
        if (next === "like") await likeComment(comment.id);
        else await dislikeComment(comment.id);
        setReaction(next);
      }
      const c = await getCommentReactionCount(comment.id);
      setLikes(c.like_count || 0);
      setDislikes(c.dislike_count || 0);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not update your reaction."));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setConfirmDelete(false);
    setError("");
    try {
      await onDelete(comment.id);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not delete the comment."));
    }
  }

  return (
    <div className="comment-thread">
      <div className="comment-card">
        <div className="comment-identity">
          <Avatar name={author} src={comment.avatar_url} size="sm" />
          <div>
            {comment.username ? (
              <Link className="comment-profile-link" to={`/profile/${encodeURIComponent(comment.username)}`}>
                <strong>{author}</strong>
              </Link>
            ) : (
              <strong>{author}</strong>
            )}
            {comment.username && <span className="comment-handle">@{comment.username}</span>}
          </div>
        </div>
        {editing ? (
          <CommentForm
            initialValue={comment.comment}
            submitLabel="Save"
            placeholder="Edit your comment"
            onCancel={() => setEditing(false)}
            onSubmit={async (text) => {
              await onEdit(comment.id, text);
              setEditing(false);
            }}
          />
        ) : (
          <p className="comment-text">{comment.comment}</p>
        )}

        <div className="comment-footer">
          <div className="comment-tools">
            <button
              type="button"
              className={`react-btn ${reaction === "like" ? "active" : ""}`}
              onClick={() => react("like")}
              disabled={!loggedIn || busy}
              aria-pressed={reaction === "like"}
              aria-label="Like comment"
            >
              👍 <span>{likes}</span>
            </button>
            <button
              type="button"
              className={`react-btn ${reaction === "dislike" ? "active" : ""}`}
              onClick={() => react("dislike")}
              disabled={!loggedIn || busy}
              aria-pressed={reaction === "dislike"}
              aria-label="Dislike comment"
            >
              👎 <span>{dislikes}</span>
            </button>
            {loggedIn && (
              <button
                type="button"
                className="link-btn"
                onClick={() => setReplying((r) => !r)}
              >
                Reply
              </button>
            )}
            {isOwner && (
              <KebabMenu
                label="Comment actions"
                items={[
                  { label: "Edit", onClick: () => setEditing(true) },
                  {
                    label: "Delete",
                    danger: true,
                    onClick: () => setConfirmDelete(true),
                  },
                ]}
              />
            )}
          </div>
        </div>

        <ErrorMessage message={error} />

        {replying && (
          <ReplyForm
            onCancel={() => setReplying(false)}
            onSubmit={async (text) => {
              await onReply(text, comment.id);
              setReplying(false);
            }}
          />
        )}
      </div>

      {replies.length > 0 && (
        <div className="comment-replies">
          {replies.map((r) => (
            <CommentItem
              key={r.id}
              comment={r}
              childrenMap={childrenMap}
              loggedIn={loggedIn}
              currentUserId={currentUserId}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete comment?"
        message={
          replies.length
            ? "This comment and all replies to it will be permanently deleted."
            : "This comment will be permanently deleted."
        }
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

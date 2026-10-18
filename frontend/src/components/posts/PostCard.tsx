import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Post } from "../../types/post";
import type { Comment } from "../../types/comment";
import { deletePost as removePost, updatePost } from "../../api/posts";
import {
  getCommentsForPost,
  createComment,
  updateComment,
  deleteComment,
} from "../../api/comments";
import { getApiErrorMessage } from "../../api/errors";
import { isLoggedIn } from "../../auth/token";
import { useCurrentUser } from "../../auth/useCurrentUser";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Textarea } from "../ui/Textarea";
import { KebabMenu } from "../ui/KebabMenu";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { ErrorMessage } from "../ui/ErrorMessage";
import { PostActions } from "./PostActions";
import { CommentList } from "../comments/CommentList";

export const POST_MAX_LENGTH = 500; // matches the post-service limit

function time(v?: string) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function PostCard({
  post,
  likedByMe = false,
  onDeleted,
  onUpdated,
}: {
  post: Post;
  likedByMe?: boolean;
  onDeleted?: (postId: number) => void;
  onUpdated?: (post: Post) => void;
}) {
  const pid = post.post_id ?? post.id;
  const loggedIn = isLoggedIn();
  const me = useCurrentUser();
  const isOwner = me != null && post.user_id === me.id;

  const [content, setContent] = useState(post.content);
  const [comments, setComments] = useState<Comment[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.content);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setContent(post.content);
  }, [post.content]);

  const loadComments = useCallback(async () => {
    if (!pid) return;
    try {
      setComments(await getCommentsForPost(pid));
    } catch {
      setComments([]);
    }
  }, [pid]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  if (!pid) return null;

  const name = post.display_name || post.username || "Unknown author";

  async function savePost() {
    const text = draft.trim();
    if (!text) return;
    setSaving(true);
    setError("");
    try {
      const updated = await updatePost(pid!, text);
      setContent(updated.content);
      onUpdated?.({ ...post, ...updated });
      setEditing(false);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not update the post."));
    } finally {
      setSaving(false);
    }
  }

  async function confirmRemove() {
    setConfirmDelete(false);
    setError("");
    try {
      await removePost(pid!);
      onDeleted?.(pid!);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not delete the post."));
    }
  }

  // Re-fetch after adding so the new comment arrives with author info.
  async function addComment(text: string, parentId?: number) {
    await createComment(pid!, text, parentId);
    await loadComments();
  }

  async function editComment(id: number, text: string) {
    await updateComment(id, text);
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, comment: text } : c)),
    );
  }

  async function removeComment(id: number) {
    const deletedIds = await deleteComment(id);
    setComments((prev) => prev.filter((c) => !deletedIds.includes(c.id)));
  }

  return (
    <article className="post-card">
      <header className="post-top">
        <Avatar src={post.avatar_url} name={name} />
        <div className="post-meta">
          {post.username ? (
            <Link to={`/profile/${encodeURIComponent(post.username)}`} className="post-author-link">
              <strong>{name}</strong>
            </Link>
          ) : (
            <strong>{name}</strong>
          )}
          <span>
            {post.username ? `@${post.username}` : ""}
            {time(post.created_at) &&
              `${post.username ? " · " : ""}${time(post.created_at)}`}
          </span>
        </div>
        {isOwner && (
          <KebabMenu
            label="Post actions"
            items={[
              {
                label: "Edit",
                onClick: () => {
                  setDraft(content);
                  setEditing(true);
                },
              },
              {
                label: "Delete",
                danger: true,
                onClick: () => setConfirmDelete(true),
              },
            ]}
          />
        )}
      </header>

      {editing ? (
        <div className="post-edit">
          <Textarea
            aria-label="Edit post"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={POST_MAX_LENGTH}
          />
          <div className="post-edit-actions">
            <span className="muted">
              {draft.length}/{POST_MAX_LENGTH}
            </span>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button loading={saving} disabled={!draft.trim()} onClick={savePost}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <p className="post-content">{content}</p>
      )}

      <ErrorMessage message={error} />

      <PostActions postId={pid} loggedIn={loggedIn} initiallyLiked={likedByMe} />

      <CommentList
        comments={comments}
        loggedIn={loggedIn}
        currentUserId={me?.id}
        onAdd={addComment}
        onEdit={editComment}
        onDelete={removeComment}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete post?"
        message="This post, its comments and its likes will be permanently deleted."
        onConfirm={confirmRemove}
        onCancel={() => setConfirmDelete(false)}
      />
    </article>
  );
}

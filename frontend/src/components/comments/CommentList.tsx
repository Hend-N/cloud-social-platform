import { useMemo } from "react";
import type { Comment } from "../../types/comment";
import { CommentForm } from "./CommentForm";
import { CommentItem } from "./CommentItem";

export function CommentList({
  comments,
  loggedIn,
  currentUserId,
  onAdd,
  onEdit,
  onDelete,
}: {
  comments: Comment[];
  loggedIn: boolean;
  currentUserId?: number;
  onAdd: (text: string, parentId?: number) => Promise<void>;
  onEdit: (id: number, text: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const { roots, childrenMap } = useMemo(() => {
    const ids = new Set(comments.map((c) => c.id));
    const map = new Map<number, Comment[]>();
    const rootList: Comment[] = [];
    for (const c of comments) {
      const parent = c.parent_comment_id;
      // A reply whose parent is missing is shown as a top-level comment
      // rather than silently disappearing.
      if (parent == null || !ids.has(parent)) {
        rootList.push(c);
      } else {
        const bucket = map.get(parent) ?? [];
        bucket.push(c);
        map.set(parent, bucket);
      }
    }
    return { roots: rootList, childrenMap: map };
  }, [comments]);

  return (
    <section className="comments">
      <h3 className="comments-title">
        Comments <span>{comments.length}</span>
      </h3>
      {loggedIn ? (
        <CommentForm onSubmit={(text) => onAdd(text)} />
      ) : (
        <div className="login-inline">Sign in to join the conversation.</div>
      )}
      {roots.length === 0 && (
        <p className="comments-empty">No comments yet.</p>
      )}
      {roots.map((c) => (
        <CommentItem
          key={c.id}
          comment={c}
          childrenMap={childrenMap}
          loggedIn={loggedIn}
          currentUserId={currentUserId}
          onReply={(text, parentId) => onAdd(text, parentId)}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </section>
  );
}

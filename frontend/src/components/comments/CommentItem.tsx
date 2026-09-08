import { useState } from "react";
import type { Comment } from "../../types/comment";
import { Avatar } from "../ui/Avatar";
import { ReplyForm } from "./ReplyForm";
import {
  likeComment,
  dislikeComment,
  removeCommentReaction,
  getCommentReactionCount,
  getMyCommentReaction,
} from "../../api/likes";
export function CommentItem({
  comment,
  replies,
  loggedIn,
  onReply,
}: {
  comment: Comment;
  replies: Comment[];
  loggedIn: boolean;
  onReply: (text: string, parent: number) => Promise<void>;
}) {
  const [replying, setReplying] = useState(false),
    [reaction, setReaction] = useState<"like" | "dislike" | null>(null),
    [likes, setLikes] = useState(0),
    [dislikes, setDislikes] = useState(0);
  const name = comment.username || "User";
  async function react(r: "like" | "dislike") {
    if (!loggedIn) return;
    try {
      if (reaction === r) {
        await removeCommentReaction(comment.id);
        setReaction(null);
      } else {
        if (r === "like") await likeComment(comment.id);
        else await dislikeComment(comment.id);
        setReaction(r);
      }
      const c = await getCommentReactionCount(comment.id);
      setLikes(c.like_count || 0);
      setDislikes(c.dislike_count || 0);
    } catch {}
  }
  useState(() => {
    if (loggedIn)
      getMyCommentReaction(comment.id)
        .then(setReaction)
        .catch(() => {});
  });
  return (
    <div className="comment-item">
      <Avatar size="sm" name={name} />
      <div className="comment-body">
        <div className="comment-head">
          <strong>{name}</strong>
          <span>@{comment.username || "user"}</span>
        </div>
        <p>{comment.comment}</p>
        <div className="comment-tools">
          <button
            className={reaction === "like" ? "active" : ""}
            onClick={() => react("like")}
            disabled={!loggedIn}
          >
            Like {likes || ""}
          </button>
          <button
            className={reaction === "dislike" ? "active" : ""}
            onClick={() => react("dislike")}
            disabled={!loggedIn}
          >
            Dislike {dislikes || ""}
          </button>
          {loggedIn && (
            <button onClick={() => setReplying((x) => !x)}>Reply</button>
          )}
        </div>
        {replying && (
          <ReplyForm
            onSubmit={async (text) => {
              await onReply(text, comment.id);
              setReplying(false);
            }}
          />
        )}
        {replies.length > 0 && (
          <div className="replies">
            {replies.map((r) => (
              <CommentItem
                key={r.id}
                comment={r}
                replies={[]}
                loggedIn={loggedIn}
                onReply={onReply}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

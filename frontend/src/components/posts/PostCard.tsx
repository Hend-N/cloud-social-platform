import type { Post } from "../../types/post";
import type { Comment } from "../../types/comment";
import { Avatar } from "../ui/Avatar";
import { PostActions } from "./PostActions";
import { CommentList } from "../comments/CommentList";
function id(p: Post) {
  return p.post_id ?? p.id;
}
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
  likeCount,
  comments,
  loggedIn,
  onComment,
  allowComments = true,
}: {
  post: Post;
  likeCount: number;
  comments: Comment[];
  loggedIn: boolean;
  onComment: (postId: number, text: string, parent?: number) => Promise<void>;
  allowComments?: boolean;
}) {
  const pid = id(post);
  if (!pid) return null;
  const name = post.display_name || post.username || "User";
  return (
    <article className="post-card">
      <div className="post-top">
        <Avatar src={post.avatar_url} name={name} />
        <div className="post-meta">
          <strong>{name}</strong>
          <span>
            @{post.username || "user"}
            {time(post.created_at) && <> · {time(post.created_at)}</>}
          </span>
        </div>
      </div>
      <p className="post-content">{post.content}</p>
      <PostActions postId={pid} likeCount={likeCount} loggedIn={loggedIn} />
      {allowComments && (
        <CommentList
          comments={comments}
          loggedIn={loggedIn}
          onAddComment={(text, parent) => onComment(pid, text, parent)}
        />
      )}
    </article>
  );
}

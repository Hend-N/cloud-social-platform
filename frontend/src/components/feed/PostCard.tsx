import { useState } from "react";
import type { FormEvent } from "react";
import type { Post } from "../../api/posts";
import type { Comment } from "../../api/comments";
import type { Profile } from "../../api/users";
import "./PostCard.css";

interface PostCardProps {
  post: Post;
  postId: number;
  likeCount: number;
  comments: Comment[];
  loggedIn: boolean;
  profilesByUserId?: Record<number, Profile>;
  onLike: (post: Post) => void;
  onUnlike: (post: Post) => void;
  onAddComment: (post: Post, text: string) => void;
}

export function PostCard({
  post,
  postId: _postId,
  likeCount,
  comments,
  loggedIn,
  profilesByUserId = {},
  onLike,
  onUnlike,
  onAddComment,
}: PostCardProps) {
  const [commentText, setCommentText] = useState("");

  const postUserId = post.user_id;
  const postProfile = postUserId ? profilesByUserId[postUserId] : undefined;

  // Resolve valid handle, filtering out literal string "me"
  const rawUsername = postProfile?.username || post.username;
  const authorUsername =
    rawUsername && rawUsername !== "me" ? rawUsername : null;

  const authorName =
    postProfile?.display_name ||
    post.display_name ||
    authorUsername ||
    "User";

  const avatarUrl = postProfile?.avatar_url || post.avatar_url;
  const initial = authorName.charAt(0).toUpperCase();

  function handleCommentSubmit(e: FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    onAddComment(post, commentText);
    setCommentText("");
  }

  return (
    <article className="feed-card">
      {/* Post Author Header */}
      <div className="feed-card-header">
        <div className="feed-avatar-frame">
          {avatarUrl ? (
            <img src={avatarUrl} alt={authorName} className="feed-avatar-img" />
          ) : (
            <div className="feed-avatar-placeholder">{initial}</div>
          )}
        </div>
        <div className="feed-author-meta">
          <span className="feed-author-name">{authorName}</span>
          {authorUsername && (
            <span className="feed-author-handle">
              @{authorUsername}
            </span>
          )}
        </div>
      </div>

      {/* Post Body */}
      <div className="feed-card-body">
        <p className="feed-post-text">{post.content}</p>
      </div>

      {/* Post Actions */}
      <div className="feed-card-actions">
        <span className="likes-counter">Likes: {likeCount}</span>
        {loggedIn && (
          <div className="action-buttons">
            <button
              type="button"
              onClick={() => onLike(post)}
              className="btn btn-like"
            >
              Like
            </button>
            <button
              type="button"
              onClick={() => onUnlike(post)}
              className="btn btn-unlike"
            >
              Unlike
            </button>
          </div>
        )}
      </div>

      <hr className="feed-divider" />

      {/* Comments List */}
      <div className="feed-comments-section">
        <h4 className="comments-title">Comments</h4>

        {comments.length > 0 ? (
          <div className="comments-list">
            {comments.map((comment, index) => {
              const commenterUserId = comment.user_id;
              const commenterProfile = commenterUserId
                ? profilesByUserId[commenterUserId]
                : undefined;

              const rawCommenterUsername = commenterProfile?.username;
              const commenterName =
                commenterProfile?.display_name ||
                (rawCommenterUsername && rawCommenterUsername !== "me"
                  ? rawCommenterUsername
                  : null) ||
                "User";

              const commentAvatarUrl = commenterProfile?.avatar_url;
              const commenterInitial = commenterName.charAt(0).toUpperCase();

              const commentKey =
                comment.comment_id || comment.id || `comment-${index}`;

              return (
                <div key={commentKey} className="comment-item">
                  <div className="comment-avatar-frame">
                    {commentAvatarUrl ? (
                      <img
                        src={commentAvatarUrl}
                        alt={commenterName}
                        className="comment-avatar-img"
                      />
                    ) : (
                      <div className="comment-avatar-placeholder">
                        {commenterInitial}
                      </div>
                    )}
                  </div>
                  <div className="comment-bubble">
                    <span className="comment-author-name">{commenterName}</span>
                    <p className="comment-text">{comment.content}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="no-comments-text">No comments yet.</p>
        )}

        {/* Comment Form */}
        {loggedIn && (
          <form onSubmit={handleCommentSubmit} className="comment-form">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              className="comment-input"
            />
            <button
              type="submit"
              disabled={!commentText.trim()}
              className="btn btn-comment"
            >
              Comment
            </button>
          </form>
        )}
      </div>
    </article>
  );
}
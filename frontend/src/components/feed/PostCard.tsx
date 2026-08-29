import type { Post } from "../../api/posts";
import type { Comment } from "../../api/comments";
import type { Profile } from "../../api/users";

import { CommentList } from "./CommentList";

import "./PostCard.css";

interface PostCardProps {
  post: Post;
  postId: number;
  likeCount: number;
  comments: Comment[];
  loggedIn: boolean;

  profilesByUserId?: Record<number, Profile>;

  currentUserId?: number;

  onLike: (post: Post) => void;
  onUnlike: (post: Post) => void;

  onAddComment: (
    post: Post,
    text: string,
    parentId?: number
  ) => Promise<void>;

  onDeleteComment?: (
    commentId: number
  ) => Promise<void>;
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
  onDeleteComment,
  currentUserId,
}: PostCardProps) {

  const postUserId = post.user_id;

  const postProfile =
    postUserId
      ? profilesByUserId[postUserId]
      : undefined;

  const rawUsername =
    postProfile?.username ||
    post.username;

  const authorUsername =
    rawUsername &&
    rawUsername !== "me"
      ? rawUsername
      : null;

  const authorName =
    postProfile?.display_name ||
    post.display_name ||
    authorUsername ||
    "User";

  const avatarUrl =
    postProfile?.avatar_url ||
    post.avatar_url;

  const initial =
    authorName.charAt(0).toUpperCase();

  return (
    <article className="feed-card">

      {/* =========================
          POST AUTHOR
          ========================= */}

      <div className="feed-card-header">

        <div className="feed-avatar-frame">

          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={authorName}
              className="feed-avatar-img"
            />
          ) : (
            <div className="feed-avatar-placeholder">
              {initial}
            </div>
          )}

        </div>

        <div className="feed-author-meta">

          <span className="feed-author-name">
            {authorName}
          </span>

          {authorUsername && (
            <span className="feed-author-handle">
              @{authorUsername}
            </span>
          )}

        </div>

      </div>

      {/* =========================
          POST BODY
          ========================= */}

      <div className="feed-card-body">

        <p className="feed-post-text">
          {post.content}
        </p>

      </div>

      {/* =========================
          POST ACTIONS
          ========================= */}

            <div className="feed-card-actions">

            <span className="likes-counter">
              Likes: {likeCount}
            </span>

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

      <CommentList
        comments={comments}
        loggedIn={loggedIn}
        currentUserId={currentUserId}
        onAddComment={async (
          text,
          parentId
        ) => {
          await onAddComment(
            post,
            text,
            parentId
          );
        }}
        onDeleteComment={onDeleteComment}
      />

    </article>
  );
}
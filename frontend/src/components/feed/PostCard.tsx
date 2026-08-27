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

  onAddComment: (
    post: Post,
    text: string
  ) => void;
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

  const [commentText, setCommentText] =
    useState("");

  /*
   * -------------------------
   * POST AUTHOR
   * -------------------------
   */

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

  /*
   * -------------------------
   * COMMENT SUBMIT
   * -------------------------
   */

  function handleCommentSubmit(
    e: FormEvent
  ) {
    e.preventDefault();

    const trimmed =
      commentText.trim();

    if (!trimmed) {
      return;
    }

    onAddComment(
      post,
      trimmed
    );

    setCommentText("");
  }

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

      {/* =========================
          COMMENTS
          ========================= */}

      <div className="feed-comments-section">

        <h4 className="comments-title">
          Comments
        </h4>

        {comments.length > 0 ? (

          <div className="comments-list">

            {comments.map(
              (comment, index) => {

                /*
                 * The comments service gives us:
                 *
                 * {
                 *   id: 18,
                 *   user_id: 1,
                 *   comment: "nbgfv"
                 * }
                 */

                const commenterUserId =
                  comment.user_id;

                /*
                 * Find the profile belonging
                 * to that user_id.
                 */

                const commenterProfile =
                  commenterUserId
                    ? profilesByUserId[
                        commenterUserId
                      ]
                    : undefined;

                const commenterUsername =
                  commenterProfile?.username;

                const commenterName =
                  commenterProfile?.display_name ||
                  commenterUsername ||
                  "User";

                const commentAvatarUrl =
                  commenterProfile?.avatar_url;

                const commenterInitial =
                  commenterName
                    .charAt(0)
                    .toUpperCase();

                /*
                 * IMPORTANT:
                 *
                 * Your backend calls this field
                 * "comment".
                 */

                const textContent =
                  comment.comment ||
                  comment.comment ||
                  comment.comment ||
                  "";

                const commentKey =
                  comment.id ||
                  comment.id ||
                  `comment-${index}`;

                return (
                  <div
                    key={commentKey}
                    className="comment-item"
                  >

                    {/* Avatar */}

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

                    {/* Comment */}

                    <div className="comment-bubble">

                      <span className="comment-author-name">
                        {commenterName}
                      </span>

                      <p className="comment-text">
                        {textContent}
                      </p>

                    </div>

                  </div>
                );
              }
            )}

          </div>

        ) : (

          <p className="no-comments-text">
            No comments yet.
          </p>

        )}

        {/* =========================
            COMMENT FORM
            ========================= */}

        {loggedIn && (

          <form
            onSubmit={handleCommentSubmit}
            className="comment-form"
          >

            <input
              type="text"
              value={commentText}
              onChange={(e) =>
                setCommentText(e.target.value)
              }
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
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { createPost, getPosts } from "../api/posts";
import type { Post } from "../api/posts";

import { getLikeCount, likePost, unlikePost } from "../api/likes";

import {
  createComment,
  getCommentsForPost,
} from "../api/comments";
import type { Comment } from "../api/comments";

import { isLoggedIn } from "../auth/token";

function getPostId(post: Post) {
  return post.post_id || post.id;
}

function getCommentId(comment: Comment) {
  return comment.comment_id || comment.id;
}

export function FeedPage() {
  const loggedIn = isLoggedIn();

  const [posts, setPosts] = useState<Post[]>([]);
  const [likeCounts, setLikeCounts] = useState<Record<number, number>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<number, Comment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});

  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");

  async function loadLikeCounts(postsToLoad: Post[]) {
    const counts: Record<number, number> = {};

    await Promise.all(
      postsToLoad.map(async (post) => {
        const postId = getPostId(post);

        if (!postId) {
          return;
        }

        try {
          counts[postId] = await getLikeCount(postId);
        } catch {
          counts[postId] = 0;
        }
      })
    );

    setLikeCounts(counts);
  }

  async function loadComments(postsToLoad: Post[]) {
    const commentsMap: Record<number, Comment[]> = {};

    await Promise.all(
      postsToLoad.map(async (post) => {
        const postId = getPostId(post);

        if (!postId) {
          return;
        }

        try {
          commentsMap[postId] = await getCommentsForPost(postId);
        } catch {
          commentsMap[postId] = [];
        }
      })
    );

    setCommentsByPost(commentsMap);
  }

  async function loadPosts() {
    try {
      const data = await getPosts();

      setPosts(data);

      await Promise.all([
        loadLikeCounts(data),
        loadComments(data),
      ]);
    } catch (error: any) {
      setMessage(error.response?.data?.detail || "Failed to load posts.");
    }
  }

  async function handleCreatePost(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    if (!content.trim()) {
      setMessage("Post content cannot be empty.");
      return;
    }

    try {
      await createPost(content);
      setContent("");
      setMessage("Post created.");
      await loadPosts();
    } catch (error: any) {
      setMessage(error.response?.data?.detail || "Failed to create post.");
    }
  }

  async function handleLike(post: Post) {
    const postId = getPostId(post);

    if (!postId) {
      setMessage("Could not find post ID.");
      return;
    }

    try {
      await likePost(postId);

      const updatedCount = await getLikeCount(postId);

      setLikeCounts((currentCounts) => ({
        ...currentCounts,
        [postId]: updatedCount,
      }));

      setMessage("Post liked.");
    } catch (error: any) {
      setMessage(error.response?.data?.detail || "Failed to like post.");
    }
  }

  async function handleUnlike(post: Post) {
    const postId = getPostId(post);

    if (!postId) {
      setMessage("Could not find post ID.");
      return;
    }

    try {
      await unlikePost(postId);

      const updatedCount = await getLikeCount(postId);

      setLikeCounts((currentCounts) => ({
        ...currentCounts,
        [postId]: updatedCount,
      }));

      setMessage("Post unliked.");
    } catch (error: any) {
      setMessage(error.response?.data?.detail || "Failed to unlike post.");
    }
  }

  async function handleCreateComment(event: FormEvent, post: Post) {
    event.preventDefault();
    setMessage("");

    const postId = getPostId(post);

    if (!postId) {
      setMessage("Could not find post ID.");
      return;
    }

    const commentText = commentDrafts[postId] || "";

    if (!commentText.trim()) {
      setMessage("Comment cannot be empty.");
      return;
    }

    try {
      await createComment(postId, commentText);

      setCommentDrafts((currentDrafts) => ({
        ...currentDrafts,
        [postId]: "",
      }));

      const updatedComments = await getCommentsForPost(postId);

      setCommentsByPost((currentComments) => ({
        ...currentComments,
        [postId]: updatedComments,
      }));

      setMessage("Comment added.");
    } catch (error: any) {
      setMessage(error.response?.data?.detail || "Failed to add comment.");
    }
  }

  useEffect(() => {
    loadPosts();
  }, []);

  return (
    <section>
      <h2>Feed</h2>

      {loggedIn ? (
        <form onSubmit={handleCreatePost} style={{ marginBottom: "24px" }}>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="What's happening?"
            rows={4}
            style={{
              width: "100%",
              maxWidth: "600px",
              padding: "12px",
              borderRadius: "8px",
              display: "block",
              marginBottom: "12px",
            }}
          />

          <button type="submit">Create Post</button>
        </form>
      ) : (
        <p>Log in to create a post.</p>
      )}

      {message && <p>{message}</p>}

      {posts.length === 0 && <p>No posts yet.</p>}

      {posts.map((post) => {
        const postId = getPostId(post);
        const postComments = postId ? commentsByPost[postId] || [] : [];
        const commentDraft = postId ? commentDrafts[postId] || "" : "";

        return (
          <article
            key={postId}
            style={{
              border: "1px solid #334155",
              padding: "16px",
              marginBottom: "12px",
              borderRadius: "8px",
            }}
          >
            <p>{post.content}</p>

            <small>Post ID: {postId}</small>

            <div style={{ marginTop: "12px" }}>
              <span>
                Likes: {postId && likeCounts[postId] !== undefined ? likeCounts[postId] : 0}
              </span>

              {loggedIn ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleLike(post)}
                    style={{ marginLeft: "12px" }}
                  >
                    Like
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUnlike(post)}
                    style={{ marginLeft: "8px" }}
                  >
                    Unlike
                  </button>
                </>
              ) : (
                <span style={{ marginLeft: "12px" }}>
                  Log in to like posts.
                </span>
              )}
            </div>

            <section
              style={{
                marginTop: "16px",
                paddingTop: "12px",
                borderTop: "1px solid #334155",
              }}
            >
              <h3>Comments</h3>

              {postComments.length === 0 && <p>No comments yet.</p>}

              {postComments.map((comment) => (
                <div
                  key={getCommentId(comment)}
                  style={{
                    border: "1px solid #1e293b",
                    padding: "8px",
                    borderRadius: "6px",
                    marginBottom: "8px",
                  }}
                >
                  <p>{comment.comment}</p>
                  <small>
                    User ID: {comment.user_id ?? "unknown"}
                  </small>
                </div>
              ))}

              {loggedIn ? (
                <form onSubmit={(event) => handleCreateComment(event, post)}>
                  <input
                    value={commentDraft}
                    onChange={(event) => {
                      if (!postId) {
                        return;
                      }

                      setCommentDrafts((currentDrafts) => ({
                        ...currentDrafts,
                        [postId]: event.target.value,
                      }));
                    }}
                    placeholder="Write a comment..."
                    style={{
                      width: "100%",
                      maxWidth: "500px",
                      padding: "8px",
                      marginTop: "8px",
                      marginRight: "8px",
                    }}
                  />

                  <button type="submit">Comment</button>
                </form>
              ) : (
                <p>Log in to comment.</p>
              )}
            </section>
          </article>
        );
      })}
    </section>
  );
}
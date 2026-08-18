import { useEffect, useState } from "react";
import { createPost, getPosts } from "../api/posts";
import type { Post } from "../api/posts";
import { getLikeCount, likePost, unlikePost } from "../api/likes";
import { createComment, getCommentsForPost } from "../api/comments";
import type { Comment } from "../api/comments";
import { getPublicProfile } from "../api/users";
import type { Profile } from "../api/users";
import { getApiErrorMessage } from "../api/errors";
import { isLoggedIn } from "../auth/token";

import { Alert } from "../components/ui/Alert";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { EmptyState } from "../components/ui/EmptyState";
import { CreatePostForm } from "../components/feed/CreatePostForm";
import { PostCard } from "../components/feed/PostCard";

function getPostId(post: Post) {
  return post.post_id || post.id;
}

export function FeedPage() {
  const loggedIn = isLoggedIn();

  const [posts, setPosts] = useState<Post[]>([]);
  const [likeCounts, setLikeCounts] = useState<Record<number, number>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<number, Comment[]>>({});
  const [profilesByUserId, setProfilesByUserId] = useState<Record<number, Profile>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  async function loadLikeCounts(postsToLoad: Post[]) {
    const counts: Record<number, number> = {};
    await Promise.all(
      postsToLoad.map(async (post) => {
        const postId = getPostId(post);
        if (!postId) return;
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
        if (!postId) return;
        try {
          commentsMap[postId] = await getCommentsForPost(postId);
        } catch {
          commentsMap[postId] = [];
        }
      })
    );
    setCommentsByPost(commentsMap);
    return commentsMap;
  }

  async function loadUserProfiles(postsToLoad: Post[]) {
    const usernamesToFetch = new Set<string>();

    postsToLoad.forEach((p) => {
      if (p.username) usernamesToFetch.add(p.username.toLowerCase());
    });

    const profileMap: Record<number, Profile> = {};
    await Promise.all(
      Array.from(usernamesToFetch).map(async (uname) => {
        try {
          const profile = await getPublicProfile(uname);
          if (profile && profile.user_id) {
            profileMap[profile.user_id] = profile;
          }
        } catch {
        }
      })
    );

    setProfilesByUserId(profileMap);
  }

  async function loadPosts() {
    setIsLoading(true);
    setError("");

    try {
      const data = await getPosts();
      setPosts(data);

      await Promise.all([
        loadLikeCounts(data),
        loadComments(data),
        loadUserProfiles(data),
      ]);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Failed to load posts."));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreatePost(content: string) {
    setStatusMessage("");
    try {
      await createPost(content);
      setStatusMessage("");
      await loadPosts();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Failed to create post."));
    }
  }

  async function handleLike(post: Post) {
    const postId = getPostId(post);
    if (!postId) return;

    try {
      await likePost(postId);
      const updatedCount = await getLikeCount(postId);
      setLikeCounts((current) => ({ ...current, [postId]: updatedCount }));
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Failed to like post."));
    }
  }

  async function handleUnlike(post: Post) {
    const postId = getPostId(post);
    if (!postId) return;

    try {
      await unlikePost(postId);
      const updatedCount = await getLikeCount(postId);
      setLikeCounts((current) => ({ ...current, [postId]: updatedCount }));
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Failed to unlike post."));
    }
  }

  async function handleCreateComment(post: Post, text: string) {
    const postId = getPostId(post);
    if (!postId) return;

    try {
      await createComment(postId, text);
      const updatedComments = await getCommentsForPost(postId);
      setCommentsByPost((current) => ({ ...current, [postId]: updatedComments }));
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Failed to add comment."));
    }
  }

  useEffect(() => {
    loadPosts();
  }, []);

 return (
    <section>
      <header style={{ marginBottom: "24px" }}>
        <h2 style={{ margin: "0 0 4px 0" }}>Community Feed</h2>
        <p style={{ color: "var(--color-muted)", margin: 0 }}>
          See what people are sharing right now.
        </p>
      </header>

      {loggedIn && <CreatePostForm onPostCreated={handleCreatePost} />}

      {/* Auto-Dismissing Alerts */}
      {statusMessage && (
        <Alert
          message={statusMessage}
          type="info"
          onClose={() => setStatusMessage("")}
        />
      )}

      {error && (
        <Alert
          message={error}
          type="error"
          onClose={() => setError("")}
        />
      )}

      {isLoading ? (
        <LoadingSpinner size="lg" />
      ) : !error && posts.length === 0 ? (
        <EmptyState
          title="No posts yet"
          description="Be the first to create a post and start the conversation!"
        />
      ) : (
        posts.map((post) => {
          const postId = getPostId(post);
          if (!postId) return null;

          return (
            <PostCard
              key={postId}
              post={post}
              postId={postId}
              likeCount={likeCounts[postId] ?? 0}
              comments={commentsByPost[postId] ?? []}
              loggedIn={loggedIn}
              profilesByUserId={profilesByUserId}
              onLike={handleLike}
              onUnlike={handleUnlike}
              onAddComment={handleCreateComment}
            />
          );
        })
      )}
    </section>
  );
}
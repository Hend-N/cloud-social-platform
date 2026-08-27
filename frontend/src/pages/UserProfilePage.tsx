import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPostsByUser } from "../api/posts";
import type { Post } from "../api/posts";
import { getLikeCount, likePost, unlikePost } from "../api/likes";
import { createComment, getCommentsForPost } from "../api/comments";
import type { Comment } from "../api/comments";
import { isLoggedIn } from "../auth/token";
import { getPublicProfile } from "../api/users";
import type { Profile } from "../api/users";

import { getFollowStats } from "../api/follows";
import type { FollowStats } from "../api/follows";

import { PostCard } from "../components/feed/PostCard";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { EmptyState } from "../components/ui/EmptyState";
import { Alert } from "../components/ui/Alert";

function getPostId(post: Post) {
  return post.post_id || post.id;
}

export function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const loggedIn = isLoggedIn();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<FollowStats>({ followers_count: 0, following_count: 0 });
  const [posts, setPosts] = useState<Post[]>([]);
  const [likeCounts, setLikeCounts] = useState<Record<number, number>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<number, Comment[]>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

useEffect(() => {
    // 1. Strict guard check
    if (typeof username !== "string" || !username.trim()) return;

    // 2. Explicitly typed parameter guarantees 'string' inside the async scope
    async function loadUserData(targetUsername: string) {
      setIsLoading(true);
      setError("");

      try {
        // Fetch Profile & Stats
        const userData = await getPublicProfile(targetUsername);
        setProfile(userData);

        if (userData.user_id) {
          const userStats = await getFollowStats(userData.user_id);
          setStats(userStats);
}

        // Fetch User's Specific Posts
        const userPosts = await getPostsByUser(targetUsername);
        setPosts(userPosts);

        // Fetch Likes & Comments for User Posts
        const counts: Record<number, number> = {};
        const commentsMap: Record<number, Comment[]> = {};

        await Promise.all(
          userPosts.map(async (post) => {
            const pid = getPostId(post);
            if (!pid) return;
            try {
              counts[pid] = await getLikeCount(pid);
              commentsMap[pid] = await getCommentsForPost(pid);
            } catch {
              counts[pid] = 0;
              commentsMap[pid] = [];
            }
          })
        );

        setLikeCounts(counts);
        setCommentsByPost(commentsMap);
      } catch (err) {
        setError("Failed to load user profile.");
      } finally {
        setIsLoading(false);
      }
    }

    loadUserData(username);
  }, [username]);

  async function handleLike(post: Post) {
    const pid = getPostId(post);
    if (!pid) return;
    try {
      await likePost(pid);
      const updatedCount = await getLikeCount(pid);
      setLikeCounts((prev) => ({ ...prev, [pid]: updatedCount }));
    } catch {
      setError("Failed to like post.");
    }
  }

  async function handleUnlike(post: Post) {
    const pid = getPostId(post);
    if (!pid) return;
    try {
      await unlikePost(pid);
      const updatedCount = await getLikeCount(pid);
      setLikeCounts((prev) => ({ ...prev, [pid]: updatedCount }));
    } catch {
      setError("Failed to unlike post.");
    }
  }

  async function handleAddComment(post: Post, text: string) {
    const pid = getPostId(post);
    if (!pid) return;
    try {
      await createComment(pid, text);
      const updatedComments = await getCommentsForPost(pid);
      setCommentsByPost((prev) => ({ ...prev, [pid]: updatedComments }));
    } catch {
      setError("Failed to add comment.");
    }
  }

  if (isLoading) return <LoadingSpinner size="lg" />;

  const displayName = profile?.display_name || profile?.username || username || "User";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div style={{ maxWidth: "680px", margin: "0 auto", padding: "16px" }}>
      {error && <Alert message={error} type="error" onClose={() => setError("")} />}

      {/* Profile Header */}
      <div
        style={{
          background: "rgba(30, 41, 59, 0.7)",
          padding: "24px",
          borderRadius: "12px",
          marginBottom: "24px",
          border: "1px solid var(--color-border, #334155)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              overflow: "hidden",
              background: "#334155",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.5rem",
              fontWeight: "bold",
            }}
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={displayName}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span>{initial}</span>
            )}
          </div>

          <div>
            <h2 style={{ margin: 0 }}>{displayName}</h2>
            <span style={{ color: "var(--color-muted, #94a3b8)" }}>@{username}</span>
            {profile?.bio && <p style={{ marginTop: "8px", marginBottom: 0 }}>{profile.bio}</p>}
          </div>
        </div>

        {/* Stats */}
        <div
          style={{
            display: "flex",
            gap: "24px",
            marginTop: "16px",
            paddingTop: "16px",
            borderTop: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <span>
            <strong>{stats.followers_count}</strong> Followers
          </span>
          <span>
            <strong>{stats.following_count}</strong> Following
          </span>
          <span>
            <strong>{posts.length}</strong> Posts
          </span>
        </div>
      </div>

      {/* User Posts Section */}
      <h3 style={{ marginBottom: "16px" }}>Posts by {displayName}</h3>

      {posts.length === 0 ? (
        <EmptyState title="No posts yet" description="This user hasn't posted anything." />
      ) : (
        posts.map((post) => {
          const pid = getPostId(post);
          if (!pid) return null;

          return (
            <PostCard
              key={pid}
              post={post}
              postId={pid}
              likeCount={likeCounts[pid] ?? 0}
              comments={commentsByPost[pid] ?? []}
              loggedIn={loggedIn}
              profilesByUserId={profile ? { [profile.user_id || 0]: profile } : {}}
              onLike={handleLike}
              onUnlike={handleUnlike}
              onAddComment={handleAddComment}
            />
          );
        })
      )}
    </div>
  );
}
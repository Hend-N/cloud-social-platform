import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { getPostsByUser } from "../api/posts";
import type { Post } from "../api/posts";
import { getLikeCount, likePost, unlikePost } from "../api/likes";
import { createComment, getCommentsForPost } from "../api/comments";
import type { Comment } from "../api/comments";
import { getPublicProfile } from "../api/users";
import type { Profile } from "../api/users";

import { getFollowStats } from "../api/follows";
import type { FollowStats } from "../api/follows";

import { isLoggedIn } from "../auth/token";

import { PostCard } from "../components/posts/PostCard";
import { Spinner } from "../components/ui/Spinner";
import { EmptyState } from "../components/ui/EmptyState";
import { Alert } from "../components/ui/Alert";
import "./UserProfilePage.css";

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

  if (isLoading) return <Spinner size="lg" />;

  const displayName = profile?.display_name || profile?.username || username || "User";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="user-profile-page fade-in">
      {error && <Alert message={error} type="error" onClose={() => setError("")} />}

      {/* Profile Header */}
      <div className="user-profile-header">
        <div className="user-profile-top">
          <div className="user-profile-avatar">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt={displayName} /> : <span>{initial}</span>}
          </div>

          <div>
            <h2 className="user-profile-name">{displayName}</h2>
            <span className="user-profile-handle">@{username}</span>
            {profile?.bio && <p className="user-profile-bio">{profile.bio}</p>}
          </div>
        </div>

        {/* Stats */}
        <div className="user-profile-stats">
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
      <h3 className="user-profile-posts-title">Posts by {displayName}</h3>

      {posts.length === 0 ? (
        <EmptyState title="No posts yet" description="This user hasn't posted anything." />
      ) : (
        posts.map((post) => {
          const pid = getPostId(post);
          if (!pid) return null;
          <PostCard
            key={pid}
            post={post}
            postId={pid}
            likeCount={likeCounts[pid]}
            likedByMe={false}   // optional
            onDeleted={(id) => {
              setPosts((prev) => prev.filter((p) => getPostId(p) !== id));
            }}
            onUpdated={(updatedPost) => {
              setPosts((prev) =>
                prev.map((p) => (getPostId(p) === getPostId(updatedPost) ? updatedPost : p))
              );
            }}
          />
        })
      )}
    </div>
  );
}

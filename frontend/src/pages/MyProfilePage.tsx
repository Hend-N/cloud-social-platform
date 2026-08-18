import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { Alert } from "../components/ui/Alert";
import {
  getMyProfile,
  updateMyProfile,
  uploadMyAvatar,
  getFollowStats,
} from "../api/users";
import type { Profile, FollowStats } from "../api/users";
import { getUserPosts, deletePost } from "../api/posts";
import type { Post } from "../api/posts";
import { isLoggedIn } from "../auth/token";
import "./MyProfilePage.css";

export function MyProfilePage() {
  const loggedIn = isLoggedIn();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [stats, setStats] = useState<FollowStats>({
    followers_count: 0,
    following_count: 0,
  });

  const [posts, setPosts] = useState<Post[]>([]);
  const [deletingPostId, setDeletingPostId] = useState<number | null>(null);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loggedIn) return;

    async function loadData() {
      try {
        const data = await getMyProfile();
        if (data) {
          setProfile(data);
          setUsername(data.username || "");
          setDisplayName(data.display_name || "");
          setBio(data.bio || "");

          if (data.username) {
            try {
              const followStats = await getFollowStats(data.username);
              setStats(followStats);
            } catch {
              setStats({ followers_count: 0, following_count: 0 });
            }

            try {
              const userPosts = await getUserPosts(data.username);
              setPosts(userPosts);
            } catch {
              setPosts([]);
            }
          }
        }
      } catch (err) {
        setError("Failed to load profile details.");
      }
    }

    loadData();
  }, [loggedIn]);

  async function handleDeletePost(postId: number) {
    if (!window.confirm("Are you sure you want to delete this post?")) return;

    setDeletingPostId(postId);
    setStatusMessage("");
    setError("");

    try {
      await deletePost(postId);
      // Remove post from local state by filtering matching ID
      setPosts((prevPosts) =>
        prevPosts.filter((p) => (p.post_id || p.id) !== postId)
      );
      setStatusMessage("Post removed successfully.");
    } catch (err) {
      setError("Failed to delete post.");
    } finally {
      setDeletingPostId(null);
    }
  }

  async function handleAvatarUpload(e: FormEvent) {
    e.preventDefault();
    if (!avatarFile) return;

    setStatusMessage("");
    setError("");

    try {
      const updatedProfile = await uploadMyAvatar(avatarFile);
      setProfile(updatedProfile);
      setAvatarFile(null);
      setStatusMessage("");
    } catch (err) {
      setError("Failed to upload avatar.");
    }
  }

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setStatusMessage("");
    setError("");
    setIsSubmitting(true);

    try {
      const updated = await updateMyProfile({
        display_name: displayName,
        bio,
      });
      setProfile(updated);
      setStatusMessage("Profile updated.");
    } catch (err) {
      setError("Failed to update profile.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!loggedIn) {
    return <p className="logged-out-message">Log in to view or update your profile.</p>;
  }

  return (
    <div className="profile-wrapper">
      <div className="profile-card">
        <h2 className="profile-title">My Profile</h2>

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

        {/* Top Avatar Section */}
        <div className="avatar-header">
          <div className="avatar-frame">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile avatar" className="avatar-img" />
            ) : (
              <div className="avatar-placeholder">
                {(displayName || username || "?").charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <form onSubmit={handleAvatarUpload} className="avatar-upload-row">
            <label className="file-upload-label">
              Choose Image
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                className="hidden-file-input"
              />
            </label>

            {avatarFile && <span className="file-name">{avatarFile.name}</span>}

            <button
              type="submit"
              disabled={!profile || !avatarFile}
              className="btn btn-secondary"
            >
              Upload
            </button>
          </form>

          {/* Follow Stats */}
          {profile && (
            <div className="profile-stats">
              <div className="stat-item">
                <span className="stat-value">{stats.followers_count}</span>
                <span className="stat-label">Followers</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.following_count}</span>
                <span className="stat-label">Following</span>
              </div>
            </div>
          )}
        </div>

        <hr className="profile-divider" />

        {/* Profile Details Form */}
        <form onSubmit={handleSaveProfile} className="profile-form">
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              value={username}
              disabled
              placeholder="Username"
              className="form-input input-disabled"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Display Name</label>
            <input
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display Name"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell people about yourself..."
              rows={4}
              className="form-input form-textarea"
            />
          </div>

          <button type="submit" disabled={isSubmitting} className="btn btn-primary">
            {isSubmitting ? "Saving..." : profile ? "Save Changes" : "Create Profile"}
          </button>
        </form>

        <hr className="profile-divider" />

        {/* User Posts Section */}
        <div className="profile-posts-section">
          {posts.length === 0 ? (
            <p className="no-posts-message">No posts published yet.</p>
          ) : (
            <div className="user-posts-list">
              {posts.map((post) => {
                const targetId = post.post_id || post.id;
                return (
                  <div key={targetId} className="user-post-item">
                    <p className="user-post-content">{post.content}</p>
                    {targetId && (
                      <button
                        type="button"
                        onClick={() => handleDeletePost(targetId)}
                        disabled={deletingPostId === targetId}
                        className="btn btn-danger btn-delete-post"
                      >
                        {deletingPostId === targetId ? "Deleting..." : "Delete"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
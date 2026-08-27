import { useState } from "react";
import type { FormEvent } from "react";

import { getPublicProfile } from "../api/users";
import type { Profile } from "../api/users";

import {
  followUser,
  unfollowUser,
  checkFollowStatus,
  getFollowStats,
  type FollowStats,
} from "../api/follows";

import { getApiErrorMessage } from "../api/errors";
import { isLoggedIn, getToken } from "../auth/token";

import "./PublicProfilePage.css";

function getCurrentUsernameFromToken(): string {
  const token = getToken();

  if (!token) {
    return "";
  }

  try {
    const base64Url = token.split(".")[1];

    if (!base64Url) {
      return "";
    }

    const base64 = base64Url
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const payload = JSON.parse(
      window.atob(base64)
    );

    return typeof payload.username === "string"
      ? payload.username
      : "";
  } catch {
    return "";
  }
}

export function PublicProfilePage() {
  const loggedIn = isLoggedIn();
  const currentUsername =
    getCurrentUsernameFromToken();

  const [username, setUsername] = useState("");
  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [message, setMessage] = useState("");
  const [isSearching, setIsSearching] =
    useState(false);

  const [isFollowing, setIsFollowing] =
    useState(false);

  const [isActionLoading, setIsActionLoading] =
    useState(false);

  const [stats, setStats] =
    useState<FollowStats>({
      followers_count: 0,
      following_count: 0,
    });

  /*
   * Safely determine whether this is the
   * currently logged-in user's profile.
   */
  const isSelf =
    Boolean(
      profile?.username &&
      currentUsername &&
      profile.username.toLowerCase() ===
        currentUsername.toLowerCase()
    );

  async function handleSearch(
    event: FormEvent
  ) {
    event.preventDefault();

    const cleanUsername =
      username.trim();

    if (!cleanUsername) {
      return;
    }

    setMessage("");
    setProfile(null);
    setIsFollowing(false);
    setStats({
      followers_count: 0,
      following_count: 0,
    });

    setIsSearching(true);

    try {
      const data =
        await getPublicProfile(
          cleanUsername
        );

      /*
       * The backend should return username,
       * but protect the UI if it doesn't.
       */
      if (!data.username) {
        throw new Error(
          "Profile response did not contain a username."
        );
      }

      setProfile(data);

      if (data.user_id) {
        /*
         * Public follow statistics.
         */
        try {
          const statsData =
            await getFollowStats(
              data.user_id
            );

          setStats(statsData);
        } catch {
          setStats({
            followers_count: 0,
            following_count: 0,
          });
        }

        /*
         * Only authenticated users need
         * follow-status information.
         */
        if (
          loggedIn &&
          data.username.toLowerCase() !==
            currentUsername.toLowerCase()
        ) {
          try {
            const status =
              await checkFollowStatus(
                data.user_id
              );

            setIsFollowing(
              status.is_following
            );
          } catch {
            setIsFollowing(false);
          }
        }
      }
    } catch (error: unknown) {
      setMessage(
        getApiErrorMessage(
          error,
          "Failed to load profile."
        )
      );
    } finally {
      setIsSearching(false);
    }
  }

  async function handleToggleFollow() {
    if (
      !profile?.user_id
    ) {
      return;
    }

    setIsActionLoading(true);
    setMessage("");

    try {
      if (isFollowing) {
        await unfollowUser(
          profile.user_id
        );

        setIsFollowing(false);

        setMessage(
          `Unfollowed @${profile.username}.`
        );

        setStats((prev) => ({
          ...prev,
          followers_count:
            Math.max(
              0,
              prev.followers_count - 1
            ),
        }));
      } else {
        await followUser(
          profile.user_id
        );

        setIsFollowing(true);

        setMessage(
          `Now following @${profile.username}.`
        );

        setStats((prev) => ({
          ...prev,
          followers_count:
            prev.followers_count + 1,
        }));
      }
    } catch (error: unknown) {
      setMessage(
        getApiErrorMessage(
          error,
          "Action failed."
        )
      );
    } finally {
      setIsActionLoading(false);
    }
  }

  return (
    <div className="public-profile-wrapper">
      <div className="public-profile-card">

        <h2 className="public-profile-title">
          Find User
        </h2>

        <form
          onSubmit={handleSearch}
          className="search-form"
        >
          <input
            value={username}
            onChange={(event) =>
              setUsername(event.target.value)
            }
            placeholder="Search by username..."
            className="search-input"
          />

          <button
            type="submit"
            disabled={isSearching}
            className="btn btn-search"
          >
            {isSearching
              ? "Searching..."
              : "Search"}
          </button>
        </form>

        {message && (
          <div className="profile-alert">
            {message}
          </div>
        )}

        {profile && (
          <article className="profile-details-card">

            <div className="profile-header">

              <div className="profile-avatar-frame">

                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={`${profile.username} avatar`}
                    className="profile-avatar-img"
                  />
                ) : (
                  <div className="profile-avatar-placeholder">
                    {(
                      profile.display_name ||
                      profile.username ||
                      "?"
                    )
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}

              </div>

              <div className="profile-meta">

                <h3 className="profile-display-name">
                  {profile.display_name ||
                    profile.username}
                </h3>

                <p className="profile-handle">
                  @{profile.username}
                </p>

              </div>

            </div>

            <div className="profile-stats">

              <div className="stat-item">
                <span className="stat-value">
                  {stats.followers_count}
                </span>

                <span className="stat-label">
                  Followers
                </span>
              </div>

              <div className="stat-item">
                <span className="stat-value">
                  {stats.following_count}
                </span>

                <span className="stat-label">
                  Following
                </span>
              </div>

            </div>

            {profile.bio && (
              <p className="profile-bio">
                {profile.bio}
              </p>
            )}

            <div className="profile-actions">

              {!loggedIn ? (
                <p className="login-hint">
                  Log in to follow users.
                </p>
              ) : isSelf ? (
                <span className="self-profile-badge">
                  This is your profile
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleToggleFollow}
                  disabled={isActionLoading}
                  className={`btn ${
                    isFollowing
                      ? "btn-following"
                      : "btn-follow"
                  }`}
                >
                  {isActionLoading
                    ? "Updating..."
                    : isFollowing
                    ? "Following"
                    : "Follow"}
                </button>
              )}

            </div>

          </article>
        )}

      </div>
    </div>
  );
}
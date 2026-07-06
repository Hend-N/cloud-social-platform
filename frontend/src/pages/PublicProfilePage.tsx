import { useState } from "react";
import type { FormEvent } from "react";

import { getPublicProfile } from "../api/users";
import type { Profile } from "../api/users";

import { followUser, unfollowUser } from "../api/follows";
import { getApiErrorMessage } from "../api/errors";
import { isLoggedIn } from "../auth/token";

function getProfileUserId(profile: Profile) {
  return profile.user_id;
}

export function PublicProfilePage() {
  const loggedIn = isLoggedIn();

  const [username, setUsername] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState("");

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setProfile(null);

    try {
      const data = await getPublicProfile(username);
      setProfile(data);
    } catch (error: unknown) {
      setMessage(getApiErrorMessage(error, "Failed to load profile."));
    }
  }

  async function handleFollow() {
    if (!profile) {
      return;
    }

    const targetUserId = getProfileUserId(profile);

    if (!targetUserId) {
      setMessage("This profile does not include a user_id, so it cannot be followed yet.");
      return;
    }

    try {
      await followUser(targetUserId);
      setMessage(`You followed @${profile.username}.`);
    } catch (error: unknown) {
      setMessage(getApiErrorMessage(error, "Failed to follow user."));
    }
  }

  async function handleUnfollow() {
    if (!profile) {
      return;
    }

    const targetUserId = getProfileUserId(profile);

    if (!targetUserId) {
      setMessage("This profile does not include a user_id, so it cannot be unfollowed yet.");
      return;
    }

    try {
      await unfollowUser(targetUserId);
      setMessage(`You unfollowed @${profile.username}.`);
    } catch (error: unknown) {
      setMessage(getApiErrorMessage(error, "Failed to unfollow user."));
    }
  }

  return (
    <section>
      <h2>Find Profile</h2>

      <form onSubmit={handleSearch}>
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="username"
        />

        <button type="submit">Search</button>
      </form>

      {message && <p>{message}</p>}

      {profile && (
        <article
          style={{
            border: "1px solid #334155",
            padding: "16px",
            marginTop: "16px",
            borderRadius: "8px",
          }}
        >
          <h3>{profile.display_name}</h3>
          <p>@{profile.username}</p>
          <p>{profile.bio}</p>
          <small>User ID: {profile.user_id ?? "missing"}</small>

          <div style={{ marginTop: "12px" }}>
            {loggedIn ? (
              <>
                <button type="button" onClick={handleFollow}>
                  Follow
                </button>

                <button
                  type="button"
                  onClick={handleUnfollow}
                  style={{ marginLeft: "8px" }}
                >
                  Unfollow
                </button>
              </>
            ) : (
              <p>Log in to follow users.</p>
            )}
          </div>
        </article>
      )}
    </section>
  );
}
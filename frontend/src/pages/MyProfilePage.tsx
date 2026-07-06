import { useState } from "react";
import type { FormEvent } from "react";
import { createMyProfile, updateMyProfile } from "../api/users";
import { getApiErrorMessage } from "../api/errors";
import { isLoggedIn } from "../auth/token";

export function MyProfilePage() {
  const loggedIn = isLoggedIn();

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [message, setMessage] = useState("");

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    try {
      await createMyProfile({
        username,
        display_name: displayName,
        bio,
      });

      setMessage("Profile created.");
    } catch (error: unknown) {
      setMessage(getApiErrorMessage(error, "Failed to create profile."));
    }
  }

  async function handleUpdate(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    try {
      await updateMyProfile({
        username,
        display_name: displayName,
        bio,
      });

      setMessage("Profile updated.");
    } catch (error: unknown) {
      setMessage(getApiErrorMessage(error, "Failed to update profile."));
    }
  }

  if (!loggedIn) {
    return <p>Log in to create or update your profile.</p>;
  }

  return (
    <section>
      <h2>My Profile</h2>

      <form>
        <div>
          <label>Username</label>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="myusername"
          />
        </div>

        <div>
          <label>Display name</label>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="My Display Name"
          />
        </div>

        <div>
          <label>Bio</label>
          <textarea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="Tell people about yourself"
            rows={4}
            style={{
              width: "100%",
              maxWidth: "500px",
              display: "block",
              marginBottom: "12px",
            }}
          />
        </div>

        <button type="button" onClick={handleCreate}>
          Create Profile
        </button>

        <button
          type="button"
          onClick={handleUpdate}
          style={{ marginLeft: "8px" }}
        >
          Update Profile
        </button>
      </form>

      {message && <p>{message}</p>}
    </section>
  );
}

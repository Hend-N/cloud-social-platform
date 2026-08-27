import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { register, login } from "../api/auth";
import { createMyProfile } from "../api/users";
import { getApiErrorMessage } from "../api/errors";

import { Alert } from "../components/ui/Alert";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

export function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      // 1. Create authentication account
      await register({
        username,
        email,
        password,
      });

      // 2. Login to obtain JWT
      await login({
        identifier: email,
        password,
      });

      // 3. Create profile using authenticated JWT
      await createMyProfile({
        username,
        display_name: username,
        bio: "",
      });

      // 4. Everything succeeded
      setSuccess(
        "Account created successfully! Redirecting..."
      );

      setTimeout(() => {
        navigate("/feed");
      }, 1000);

    } catch (err: unknown) {
      console.error(
        "Registration/profile creation failed:",
        err
      );

      setError(
        getApiErrorMessage(
          err,
          "Registration failed. Please try again."
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: "420px",
        margin: "40px auto 0",
      }}
    >
      <Card>
        <h2
          style={{
            marginTop: 0,
            marginBottom: "8px",
          }}
        >
          Create an Account
        </h2>

        <p
          style={{
            color: "var(--color-muted, #94a3b8)",
            marginTop: 0,
            marginBottom: "20px",
          }}
        >
          Join the community to post and interact.
        </p>

        {error && (
          <Alert
            message={error}
            type="error"
          />
        )}

        {success && (
          <Alert
            message={success}
            type="info"
          />
        )}

        <form
          onSubmit={handleSubmit}
          style={{
            display: "grid",
            gap: "16px",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "0.875rem",
              }}
            >
              Username
            </label>

            <input
              type="text"
              required
              value={username}
              onChange={(e) =>
                setUsername(e.target.value)
              }
              placeholder="johndoe"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "6px",
                border:
                  "1px solid var(--color-border, #334155)",
                background:
                  "rgba(15, 23, 42, 0.6)",
                color: "inherit",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "0.875rem",
              }}
            >
              Email Address
            </label>

            <input
              type="email"
              required
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              placeholder="name@example.com"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "6px",
                border:
                  "1px solid var(--color-border, #334155)",
                background:
                  "rgba(15, 23, 42, 0.6)",
                color: "inherit",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "0.875rem",
              }}
            >
              Password
            </label>

            <input
              type="password"
              required
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="••••••••"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "6px",
                border:
                  "1px solid var(--color-border, #334155)",
                background:
                  "rgba(15, 23, 42, 0.6)",
                color: "inherit",
              }}
            />
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            style={{
              marginTop: "8px",
            }}
          >
            {isSubmitting
              ? "Creating Account..."
              : "Register"}
          </Button>
        </form>

        <p
          style={{
            marginTop: "20px",
            fontSize: "0.875rem",
            textAlign: "center",
            color:
              "var(--color-muted, #94a3b8)",
          }}
        >
          Already have an account?{" "}

          <Link
            to="/login"
            style={{
              color:
                "var(--color-primary, #60a5fa)",
            }}
          >
            Log In
          </Link>
        </p>
      </Card>
    </div>
  );
}
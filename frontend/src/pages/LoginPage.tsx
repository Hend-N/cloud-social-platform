import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../api/auth";
import { getApiErrorMessage } from "../api/errors";
import { Alert } from "../components/ui/Alert";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

export function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await login({ identifier, password });
      navigate("/feed");
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Login failed. Check your credentials."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: "420px", margin: "40px auto 0" }}>
      <Card>
        <h2 style={{ marginTop: 0, marginBottom: "8px" }}>Welcome Back</h2>
        <p style={{ color: "var(--color-muted, #94a3b8)", marginTop: 0, marginBottom: "20px" }}>
          Log in with your username or email address.
        </p>

        {error && <Alert message={error} type="error" />}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "6px", fontSize: "0.875rem" }}>
              Username or Email
            </label>
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Username or Email"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "6px",
                border: "1px solid var(--color-border, #334155)",
                background: "rgba(15, 23, 42, 0.6)",
                color: "inherit",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "6px", fontSize: "0.875rem" }}>
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "6px",
                border: "1px solid var(--color-border, #334155)",
                background: "rgba(15, 23, 42, 0.6)",
                color: "inherit",
              }}
            />
          </div>

          <Button type="submit" disabled={isSubmitting} style={{ marginTop: "8px" }}>
            {isSubmitting ? "Logging in..." : "Log In"}
          </Button>
        </form>

        <p
          style={{
            marginTop: "20px",
            fontSize: "0.875rem",
            textAlign: "center",
            color: "var(--color-muted, #94a3b8)",
          }}
        >
          Don't have an account?{" "}
          <Link to="/register" style={{ color: "var(--color-primary, #60a5fa)" }}>
            Register
          </Link>
        </p>
      </Card>
    </div>
  );
}
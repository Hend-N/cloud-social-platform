import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, getMe } from "../../api/auth";
import { getMyProfile, createMyProfile } from "../../api/users";
import { getApiErrorMessage } from "../../api/errors";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { ErrorMessage } from "../ui/ErrorMessage";

export function LoginForm() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login({ identifier, password });
      const u = await getMe();

      try {
        await getMyProfile();
      } catch (x: any) {
        if (x?.response?.status === 404) {
          await createMyProfile({
            username: u.username,
            display_name: u.username,
            bio: "",
          });
        } else {
          throw x;
        }
      }

      nav("/feed");
    } catch (e) {
      setError(getApiErrorMessage(e, "Unable to sign in."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="auth-form">
      <Input
        label="Username or email"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        autoComplete="username"
        required
      />
      <Input
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        required
      />
      <ErrorMessage message={error} />
      <Button type="submit" loading={loading}>
        {loading ? "Signing in" : "Sign in"}
      </Button>
    </form>
  );
}

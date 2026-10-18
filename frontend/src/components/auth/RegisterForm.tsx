import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { register, login } from "../../api/auth";
import { createMyProfile } from "../../api/users";
import { getApiErrorMessage } from "../../api/errors";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { ErrorMessage } from "../ui/ErrorMessage";
export function RegisterForm() {
  const [username, setUsername] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const nav = useNavigate();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register({ username, email, password });
      await login({ identifier: email, password });
      await createMyProfile({ username, display_name: username, bio: "" });
      nav("/feed");
    } catch (e) {
      setError(getApiErrorMessage(e, "Unable to create your account."));
    } finally {
      setLoading(false);
    }
  }
  return (
    <form onSubmit={submit} className="auth-form">
      <Input
        label="Username (3-30 characters)"
        value={username}
        onChange={(e) => setUsername(e.target.value.trim())}
        autoComplete="username"
        required
        minLength={3}
        maxLength={30}
      />
      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Input
        label="Password (8-72 characters)"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        required
        minLength={8}
        maxLength={72}
      />
      <ErrorMessage message={error} />
      <Button type="submit" loading={loading}>
        {loading ? "Creating account" : "Create account"}
      </Button>
    </form>
  );
}

import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../api/auth";
import { getApiErrorMessage } from "../api/errors";

export function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    try {
      const data = await loginUser({ email, password });

      localStorage.setItem("access_token", data.access_token);

      setMessage("Login successful.");

      navigate("/feed");
    } catch (error: unknown) {
      setMessage(getApiErrorMessage(error, "Login failed."));
    }
  }

  return (
    <section>
      <h2>Login</h2>

      <form onSubmit={handleLogin}>
        <div>
          <label>Email</label>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="user@test.com"
          />
        </div>

        <div>
          <label>Password</label>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            placeholder="Enter your password"
          />
        </div>

        <button type="submit">Login</button>
      </form>

      {message && <p>{message}</p>}
    </section>
  );
}
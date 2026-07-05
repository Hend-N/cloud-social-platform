import { useState } from "react";
import type { FormEvent } from "react";
import { registerUser } from "../api/auth";
import { getApiErrorMessage } from "../api/errors";

export function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleRegister(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    try {
      await registerUser({ email, password });
      setMessage("Register successful. You can now log in.");
    } catch (error: unknown) {
      setMessage(getApiErrorMessage(error, "Register failed."));
    }
  }

  return (
    <section>
      <h2>Register</h2>

      <form onSubmit={handleRegister}>
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
            placeholder="At least 8 characters"
          />
        </div>

        <button type="submit">Register</button>
      </form>

      {message && <p>{message}</p>}
    </section>
  );
}
import { Link } from "react-router-dom";
import { LoginForm } from "../components/auth/LoginForm";
export function LoginPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="eyebrow">WELCOME BACK</div>
        <h1>Sign in to Cloud Social</h1>
        <p className="muted">
          Continue the conversation and see what your community is sharing.
        </p>
        <LoginForm />
        <p className="auth-switch">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}

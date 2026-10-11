import { Link } from "react-router-dom";
import { LoginForm } from "../components/auth/LoginForm";
export function LoginPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Welcome back</h1>
        <LoginForm />
        <p className="auth-switch">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}

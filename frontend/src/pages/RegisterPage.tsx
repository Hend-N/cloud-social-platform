import { Link } from "react-router-dom";
import { RegisterForm } from "../components/auth/RegisterForm";
export function RegisterPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="eyebrow">JOIN THE COMMUNITY</div>
        <h1>Create your account</h1>
        <p className="muted">
          A simple place to share ideas, follow people and have real
          conversations.
        </p>
        <RegisterForm />
        <p className="auth-switch">
          Already a member? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

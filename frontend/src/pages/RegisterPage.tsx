import { Link } from "react-router-dom";
import { RegisterForm } from "../components/auth/RegisterForm";
export function RegisterPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Create your account</h1>
        <RegisterForm />
        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

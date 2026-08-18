import { Link, useNavigate } from "react-router-dom";
import { isLoggedIn, logout } from "../../auth/token";
import { Button } from "../ui/Button";
import "./Navbar.css";

export function Navbar() {
  const navigate = useNavigate();
  const loggedIn = isLoggedIn();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <header className="navbar">
      <Link to="/feed" className="navbar-brand">
        Cloud Social
      </Link>

      <nav className="navbar-links">
        <Link to="/feed">Feed</Link>
        <Link to="/profiles">Find Profile</Link>

        {loggedIn ? (
          <>
            <Link to="/profile/me">My Profile</Link>
            <Button variant="secondary" onClick={handleLogout}>
              Logout
            </Button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </nav>
    </header>
  );
}
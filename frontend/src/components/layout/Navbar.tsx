import { Link, NavLink, useNavigate } from "react-router-dom";
import { isLoggedIn, logout } from "../../auth/token";
export function Navbar() {
  const nav = useNavigate();
  const logged = isLoggedIn();
  return (
    <header className="navbar">
      <Link to="/feed" className="brand">
        <span className="brand-dot" />
        Cloud Social
      </Link>
      <nav>
        <NavLink to="/feed">Feed</NavLink>
        <NavLink to="/profiles">Discover</NavLink>
        {logged ? (
          <>
            <NavLink to="/my-posts">My posts</NavLink>
            <NavLink to="/profile/me">Profile</NavLink>
            <button
              className="nav-logout"
              onClick={() => {
                logout();
                nav("/login");
              }}
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login">Sign in</NavLink>
            <NavLink className="nav-cta" to="/register">
              Join
            </NavLink>
          </>
        )}
      </nav>
    </header>
  );
}

import { NavLink } from "react-router-dom";
import { isLoggedIn } from "../../auth/token";

export function Sidebar() {
  const logged = isLoggedIn();
  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        <NavLink to="/feed">Feed</NavLink>
        <NavLink to="/profiles">Discover</NavLink>
        {logged && <NavLink to="/my-posts">My posts</NavLink>}
        {logged && <NavLink to="/profile/me">My profile</NavLink>}
      </nav>
    </aside>
  );
}

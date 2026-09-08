import { NavLink } from "react-router-dom";
export function MobileNav() {
  return (
    <nav className="mobile-nav">
      <NavLink to="/feed">Feed</NavLink>
      <NavLink to="/profiles">Discover</NavLink>
      <NavLink to="/profile/me">Profile</NavLink>
    </nav>
  );
}

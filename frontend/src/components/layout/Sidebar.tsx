import { NavLink } from "react-router-dom";
export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-heading">Your space</div>
      <NavLink to="/profile/me?tab=posts">Posts</NavLink>
      <NavLink to="/profile/me?tab=likes">Liked posts</NavLink>
      <NavLink to="/profile/me?tab=comments">Comments</NavLink>
      <NavLink to="/profile/me?tab=replies">Replies</NavLink>
      <div className="sidebar-note">
        <strong>Build your presence.</strong>
        <span>Share ideas, follow people and join the conversation.</span>
      </div>
    </aside>
  );
}

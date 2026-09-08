import { NavLink } from "react-router-dom";
export function ProfileTabs() {
  return (
    <div className="profile-tabs">
      <NavLink to="?tab=posts">Posts</NavLink>
      <NavLink to="?tab=likes">Likes</NavLink>
      <NavLink to="?tab=comments">Comments</NavLink>
      <NavLink to="?tab=replies">Replies</NavLink>
    </div>
  );
}

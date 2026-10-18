import { Link, useSearchParams } from "react-router-dom";

const tabs = [
  { key: "posts", label: "Posts" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "replies", label: "Replies" },
];

export function ProfileTabs() {
  // NavLink only compares the pathname, so all four ?tab= links appeared
  // active simultaneously. Compare the query parameter explicitly instead.
  const [params] = useSearchParams();
  const active = params.get("tab") || "posts";
  return (
    <nav className="profile-tabs" aria-label="Profile activity">
      {tabs.map(({ key, label }) => (
        <Link
          key={key}
          to={`?tab=${key}`}
          className={active === key ? "active" : undefined}
          aria-current={active === key ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

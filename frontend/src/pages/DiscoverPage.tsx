import { useState } from "react";
import { Link } from "react-router-dom";
import { searchUsers } from "../api/users";
import { getApiErrorMessage } from "../api/errors";
import { Input } from "../components/ui/Input";
import { Avatar } from "../components/ui/Avatar";
import { Spinner } from "../components/ui/Spinner";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { FollowButton } from "../components/follows/FollowButton";
import { isLoggedIn } from "../auth/token";
import type { Profile } from "../types/user";

export function DiscoverPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const loggedIn = isLoggedIn();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    try {
      const r = await searchUsers(query.trim());
      setResults(r);
      setSearched(true);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not search for people."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="discover-page">
      <h1>Discover people</h1>
      <form className="discover-search" onSubmit={submit}>
        <Input
          placeholder="Search by username or name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>
      <ErrorMessage message={error} />
      {loading && <Spinner />}
      {!loading && searched && results.length === 0 && (
        <EmptyState
          title="No one found"
          description="Try a different username or display name."
        />
      )}
      <div className="discover-results">
        {results.map((p) => {
          const name = p.display_name || p.username || "User";
          const uid = p.user_id ?? p.id;
          return (
            <div className="discover-result" key={uid ?? p.username}>
              <Link
                to={`/profile/${encodeURIComponent(p.username || "")}`}
                className="discover-result-link"
              >
                <Avatar src={p.avatar_url} name={name} />
                <div>
                  <strong>{name}</strong>
                  <span>@{p.username}</span>
                </div>
              </Link>
              {loggedIn && uid && <FollowButton userId={uid} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

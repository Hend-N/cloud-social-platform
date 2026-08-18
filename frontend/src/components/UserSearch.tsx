import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { searchUsers } from "../api/users";
import type { Profile } from "../api/users";
import "./UserSearch.css";

interface UserSearchProps {
  onSelectUser?: (profile: Profile) => void;
}

export function UserSearch({ onSelectUser }: UserSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Strip leading '@' and trim spaces
    const cleanQuery = query.trim().replace(/^@/, "");

    if (!cleanQuery) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsOpen(true);
    
    // Fast 150ms debounce for responsive live typing
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const data = await searchUsers(cleanQuery);
        setResults(data);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsLoading(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(profile: Profile) {
    setQuery("");
    setIsOpen(false);

    if (onSelectUser) {
      onSelectUser(profile);
    } else if (profile.username) {
      navigate(`/profile/${profile.username}`);
    }
  }

  return (
    <div className="search-container" ref={containerRef}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.trim() && setIsOpen(true)}
        placeholder="Search users..."
        className="search-input"
      />

      {isOpen && (
        <div className="search-dropdown">
          {isLoading && results.length === 0 ? (
            <div className="search-message">Searching...</div>
          ) : results.length > 0 ? (
            results.map((profile) => {
              const name = profile.display_name || profile.username || "User";
              const initial = name.charAt(0).toUpperCase();

              return (
                <div
                  key={profile.user_id || profile.username}
                  className="search-item"
                  onClick={() => handleSelect(profile)}
                >
                  <div className="search-avatar">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt={name} />
                    ) : (
                      <span>{initial}</span>
                    )}
                  </div>
                  <div className="search-info">
                    <span className="search-name">{name}</span>
                    {profile.username && (
                      <span className="search-handle">@{profile.username}</span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="search-message">No users found</div>
          )}
        </div>
      )}
    </div>
  );
}
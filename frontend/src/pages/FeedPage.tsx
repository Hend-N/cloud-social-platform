import { useCallback, useEffect, useState } from "react";
import { getPosts } from "../api/posts";
import { getMyLikedPostIds } from "../api/likes";
import { isLoggedIn } from "../auth/token";
import { CreatePost } from "../components/posts/CreatePost";
import { PostList } from "../components/posts/PostList";
import { Spinner } from "../components/ui/Spinner";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { getApiErrorMessage } from "../api/errors";
import type { Post } from "../types/post";

export function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [likedPostIds, setLikedPostIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loggedIn = isLoggedIn();

  const load = useCallback(
    async (showSpinner: boolean) => {
      if (showSpinner) setLoading(true);
      setError("");
      try {
        const [p, liked] = await Promise.all([
          getPosts(),
          loggedIn ? getMyLikedPostIds() : Promise.resolve([] as number[]),
        ]);
        setPosts(p);
        setLikedPostIds(liked);
      } catch (e) {
        setError(getApiErrorMessage(e, "Could not load the feed."));
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [loggedIn],
  );

  useEffect(() => {
    load(true);
  }, [load]);

  if (loading) return <Spinner />;

  return (
    <div className="feed-page">
      {loggedIn && (
        // Reload so the new post arrives with author name/avatar.
        <CreatePost onCreated={() => load(false)} />
      )}
      <ErrorMessage message={error} />
      <PostList
        posts={posts}
        likedPostIds={likedPostIds}
        onDeleted={(id) =>
          setPosts((prev) => prev.filter((p) => (p.post_id ?? p.id) !== id))
        }
        onUpdated={(updated) =>
          setPosts((prev) =>
            prev.map((p) =>
              (p.post_id ?? p.id) === (updated.post_id ?? updated.id)
                ? { ...p, ...updated }
                : p,
            ),
          )
        }
      />
    </div>
  );
}

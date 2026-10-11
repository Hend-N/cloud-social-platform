import { useCallback, useEffect, useState } from "react";
import { getMyPosts } from "../api/posts";
import { getMyLikedPostIds } from "../api/likes";
import { getApiErrorMessage } from "../api/errors";
import { CreatePost } from "../components/posts/CreatePost";
import { PostList } from "../components/posts/PostList";
import { Spinner } from "../components/ui/Spinner";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import type { Post } from "../types/post";

export function MyPostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [likedPostIds, setLikedPostIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    setError("");
    try {
      const [mine, liked] = await Promise.all([
        getMyPosts(),
        getMyLikedPostIds(),
      ]);
      setPosts(mine);
      setLikedPostIds(liked);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not load your posts."));
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  if (loading) return <Spinner />;

  return (
    <div className="my-posts-page">
      <h1 className="page-title">My Posts &amp; Comments</h1>
      <CreatePost onCreated={() => load(false)} />
      <ErrorMessage message={error} />
      <PostList
        posts={posts}
        likedPostIds={likedPostIds}
        emptyTitle="You haven't posted yet"
        emptyDescription="Share something above and it will show up here, with its comments."
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

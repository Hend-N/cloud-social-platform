import { useEffect, useState } from "react";
import { getPosts } from "../api/posts";
import type { Post } from "../types/post";
import { getLikeCount } from "../api/likes";
import { getCommentsForPost, createComment } from "../api/comments";
import type { Comment } from "../types/comment";
import { isLoggedIn } from "../auth/token";
import { CreatePost } from "../components/posts/CreatePost";
import { PostList } from "../components/posts/PostList";
import { Spinner } from "../components/ui/Spinner";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { getApiErrorMessage } from "../api/errors";
export function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([]),
    [likes, setLikes] = useState<Record<number, number>>({}),
    [comments, setComments] = useState<Record<number, Comment[]>>({}),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const logged = isLoggedIn();
  async function load() {
    setLoading(true);
    try {
      const p = await getPosts();
      setPosts(p);
      const l: Record<number, number> = {},
        c: Record<number, Comment[]> = {};
      await Promise.all(
        p.map(async (x) => {
          const id = x.post_id ?? x.id;
          if (!id) return;
          try {
            l[id] = await getLikeCount(id);
          } catch {}
          try {
            c[id] = await getCommentsForPost(id);
          } catch {
            c[id] = [];
          }
        }),
      );
      setLikes(l);
      setComments(c);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not load the feed."));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function comment(id: number, text: string, parent?: number) {
    try {
      await createComment(id, text, parent);
      setComments((x) => ({ ...x, [id]: [...(x[id] || [])] }));
      const fresh = await getCommentsForPost(id);
      setComments((x) => ({ ...x, [id]: fresh }));
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not add your comment."));
    }
  }
  return (
    <div className="content-column">
      <section className="page-intro">
        <div>
          <div className="eyebrow">COMMUNITY FEED</div>
          <h1>What’s happening</h1>
          <p>Fresh posts from your community.</p>
        </div>
      </section>
      {logged && (
        <CreatePost
          onCreated={(p) => {
            setPosts((x) => [p, ...x]);
          }}
        />
      )}
      <ErrorMessage message={error} onClose={() => setError("")} />
      {loading ? (
        <div className="center">
          <Spinner size="lg" />
        </div>
      ) : (
        <PostList
          posts={posts}
          likes={likes}
          comments={comments}
          loggedIn={logged}
          onComment={comment}
        />
      )}
    </div>
  );
}

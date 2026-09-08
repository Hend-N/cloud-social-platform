import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPublicProfile } from "../api/users";
import type { Profile } from "../types/user";
import { getFollowStats } from "../api/follows";
import type { FollowStats } from "../types/follow";
import { getUserPosts } from "../api/posts";
import type { Post } from "../types/post";
import { getLikeCount } from "../api/likes";
import { getCommentsForPost, createComment } from "../api/comments";
import type { Comment } from "../types/comment";
import { ProfileHeader } from "../components/profile/ProfileHeader";
import { PostList } from "../components/posts/PostList";
import { Spinner } from "../components/ui/Spinner";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { isLoggedIn } from "../auth/token";
export function ProfilePage() {
  const { username } = useParams();
  const [p, setP] = useState<Profile | null>(null),
    [stats, setStats] = useState<FollowStats>({
      followers_count: 0,
      following_count: 0,
    }),
    [posts, setPosts] = useState<Post[]>([]),
    [likes, setLikes] = useState<Record<number, number>>({}),
    [comments, setComments] = useState<Record<number, Comment[]>>({}),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    if (!username) return;
    (async () => {
      try {
        const profile = await getPublicProfile(username);
        setP(profile);
        if (profile.user_id) setStats(await getFollowStats(profile.user_id));
        const ps = await getUserPosts(username, profile.user_id);
        setPosts(ps);
        const l: Record<number, number> = {},
          c: Record<number, Comment[]> = {};
        await Promise.all(
          ps.map(async (x) => {
            const id = x.post_id ?? x.id;
            if (id) {
              l[id] = await getLikeCount(id).catch(() => 0);
              c[id] = await getCommentsForPost(id).catch(() => []);
            }
          }),
        );
        setLikes(l);
        setComments(c);
      } catch {
        setError("Could not load this profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, [username]);
  async function comment(id: number, text: string, parent?: number) {
    await createComment(id, text, parent);
    setComments((x) => ({ ...x, [id]: [...(x[id] || [])] }));
    setComments((x) => ({ ...x, [id]: x[id] || [] }));
    const fresh = await getCommentsForPost(id);
    setComments((x) => ({ ...x, [id]: fresh }));
  }
  if (loading)
    return (
      <div className="center">
        <Spinner size="lg" />
      </div>
    );
  if (!p) return <ErrorMessage message={error || "Profile not found."} />;
  return (
    <div className="content-column">
      <ProfileHeader
        profile={p}
        stats={stats}
        isOwn={false}
        onFollow={() => {}}
      />
      <PostList
        posts={posts}
        likes={likes}
        comments={comments}
        loggedIn={isLoggedIn()}
        onComment={comment}
      />
    </div>
  );
}

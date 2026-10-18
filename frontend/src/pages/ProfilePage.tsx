import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPublicProfile } from "../api/users";
import { getUserPosts } from "../api/posts";
import { getFollowStats } from "../api/follows";
import { getMyLikedPostIds } from "../api/likes";
import { ProfileHeader } from "../components/profile/ProfileHeader";
import { ProfilePosts } from "../components/profile/ProfilePosts";
import { Spinner } from "../components/ui/Spinner";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { getApiErrorMessage } from "../api/errors";
import { isLoggedIn } from "../auth/token";
import { useCurrentUser } from "../auth/useCurrentUser";
import type { Profile } from "../types/user";
import type { FollowStats } from "../types/follow";
import type { Post } from "../types/post";

export function ProfilePage() {
  const { username } = useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<FollowStats>({
    followers_count: 0,
    following_count: 0,
  });
  const [posts, setPosts] = useState<Post[]>([]);
  const [likedPostIds, setLikedPostIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loggedIn = isLoggedIn();
  const me = useCurrentUser();
  const profileUserId = profile?.user_id;
  const showFollow = loggedIn && me != null && profileUserId != null && me.id !== profileUserId;
  const refreshStats = async () => {
    if (!profileUserId) return;
    try {
      setStats(await getFollowStats(profileUserId));
    } catch {
      // Keep the last known counts; following action itself shows its errors.
    }
  };

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      setProfile(null);
      setPosts([]);
      try {
        const p = await getPublicProfile(username);
        if (cancelled) return;
        setProfile(p);
        const uid = p.user_id ?? p.id;
        const [s, userPosts, liked] = await Promise.all([
          uid
            ? getFollowStats(uid)
            : Promise.resolve({ followers_count: 0, following_count: 0 }),
          getUserPosts(username, uid),
          loggedIn ? getMyLikedPostIds() : Promise.resolve([] as number[]),
        ]);
        if (cancelled) return;
        setStats(s);
        setPosts(userPosts);
        setLikedPostIds(liked);
      } catch (e) {
        if (!cancelled)
          setError(getApiErrorMessage(e, "Could not load this profile."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, loggedIn]);

  if (loading) return <Spinner />;
  if (!profile)
    return <ErrorMessage message={error || "Profile not found."} />;

  return (
    <div className="profile-page">
      <ProfileHeader
        profile={profile}
        stats={stats}
        isOwn={false}
        onFollow={showFollow ? refreshStats : undefined}
      />
      <h2 className="profile-section-title">Posts</h2>
      <ProfilePosts
        posts={posts}
        likedPostIds={likedPostIds}
        onDeleted={(id) =>
          setPosts((prev) => prev.filter((p) => (p.post_id ?? p.id) !== id))
        }
      />
    </div>
  );
}

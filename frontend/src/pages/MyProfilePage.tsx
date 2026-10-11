import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getMyProfile } from "../api/users";
import { getUserPosts, getPosts } from "../api/posts";
import { getFollowStats } from "../api/follows";
import { getMyComments } from "../api/comments";
import { getMyLikedPostIds } from "../api/likes";
import { ProfileHeader } from "../components/profile/ProfileHeader";
import { ProfileTabs } from "../components/profile/ProfileTabs";
import { ProfilePosts } from "../components/profile/ProfilePosts";
import { ProfileLikes } from "../components/profile/ProfileLikes";
import { ProfileComments } from "../components/profile/ProfileComments";
import { ProfileReplies } from "../components/profile/ProfileReplies";
import { EditProfile } from "../components/profile/EditProfile";
import { Modal } from "../components/ui/Modal";
import { Spinner } from "../components/ui/Spinner";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { getApiErrorMessage } from "../api/errors";
import type { Profile } from "../types/user";
import type { FollowStats } from "../types/follow";
import type { Post } from "../types/post";
import type { Comment } from "../types/comment";

export function MyProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<FollowStats>({
    followers_count: 0,
    following_count: 0,
  });
  const [posts, setPosts] = useState<Post[]>([]);
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [likedPostIds, setLikedPostIds] = useState<number[]>([]);
  const [myComments, setMyComments] = useState<Comment[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [params] = useSearchParams();
  const tab = params.get("tab") || "posts";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const p = await getMyProfile();
      setProfile(p);
      const uid = p.user_id ?? p.id;
      const [s, userPosts, mine, liked] = await Promise.all([
        uid ? getFollowStats(uid) : Promise.resolve({ followers_count: 0, following_count: 0 }),
        getUserPosts(p.username ?? "", uid),
        getMyComments(),
        getMyLikedPostIds(),
      ]);
      setStats(s);
      setPosts(userPosts);
      setMyComments(mine);
      setLikedPostIds(liked);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not load your profile."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The Likes tab lists every post I liked (not only my own), so it needs
  // the global feed filtered by my liked ids.
  useEffect(() => {
    if (tab !== "likes") return;
    let cancelled = false;
    getPosts()
      .then((all) => {
        if (!cancelled)
          setLikedPosts(
            all.filter((p) => likedPostIds.includes((p.post_id ?? p.id) as number)),
          );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tab, likedPostIds]);

  const dropPost = (id: number) => {
    setPosts((prev) => prev.filter((p) => (p.post_id ?? p.id) !== id));
    setLikedPosts((prev) => prev.filter((p) => (p.post_id ?? p.id) !== id));
  };

  if (loading) return <Spinner />;
  if (!profile)
    return <ErrorMessage message={error || "Profile not found."} />;

  return (
    <div className="profile-page">
      <ProfileHeader
        profile={profile}
        stats={stats}
        isOwn
        onEdit={() => setEditing(true)}
      />
      <ProfileTabs />
      {tab === "posts" && (
        <ProfilePosts
          posts={posts}
          likedPostIds={likedPostIds}
          onDeleted={dropPost}
        />
      )}
      {tab === "likes" && (
        <ProfileLikes posts={likedPosts} onDeleted={dropPost} />
      )}
      {tab === "comments" && <ProfileComments comments={myComments} />}
      {tab === "replies" && (
        <ProfileReplies
          comments={myComments.filter((c) => c.parent_comment_id != null)}
        />
      )}
      <Modal open={editing} title="Edit profile" onClose={() => setEditing(false)}>
        <EditProfile
          profile={profile}
          onSaved={(p) => {
            setProfile(p);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </Modal>
    </div>
  );
}

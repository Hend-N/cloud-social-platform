import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getMyProfile, getPublicProfileByUserId } from "../api/users";
import type { Profile } from "../types/user";
import { getFollowStats } from "../api/follows";
import { getUserPosts, getPosts } from "../api/posts";
import type { Post } from "../types/post";
import { getLikeCount, getMyLikedPostIds } from "../api/likes";
import {
  getMyComments,
  getCommentsForPost,
  createComment,
} from "../api/comments";
import type { Comment } from "../types/comment";
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
export function MyProfilePage() {
  const [params] = useSearchParams(),
    tab = params.get("tab") || "posts";
  const [profile, setProfile] = useState<Profile | null>(null),
    [stats, setStats] = useState({ followers_count: 0, following_count: 0 }),
    [posts, setPosts] = useState<Post[]>([]),
    [allPosts, setAllPosts] = useState<Post[]>([]),
    [likes, setLikes] = useState<Record<number, number>>({}),
    [comments, setComments] = useState<Record<number, Comment[]>>({}),
    [activity, setActivity] = useState<Comment[]>([]),
    [likedIds, setLikedIds] = useState<number[]>([]),
    [edit, setEdit] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    (async () => {
      try {
        const p = await getMyProfile();
        setProfile(p);
        const uid = p.user_id ?? p.id;
        if (uid) {
          setStats(await getFollowStats(uid));
          const ps = await getUserPosts(p.username || "", uid);
          setPosts(ps);
          setAllPosts(await getPosts());
          const l: Record<number, number> = {},
            c: Record<number, Comment[]> = {};
          await Promise.all(
            ps.map(async (x) => {
              const id = x.post_id ?? x.id;
              if (!id) return;
              l[id] = await getLikeCount(id).catch(() => 0);
              c[id] = await getCommentsForPost(id).catch(() => []);
            }),
          );
          setLikes(l);
          setComments(c);
        }
        setLikedIds(await getMyLikedPostIds());
        setActivity(await getMyComments());
      } catch (e) {
        setError("Could not load your profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  async function comment(id: number, text: string, parent?: number) {
    await createComment(id, text, parent);
    setComments((x) => ({ ...x, [id]: comments[id] || [] }));
    const fresh = await getCommentsForPost(id);
    setComments((x) => ({ ...x, [id]: fresh }));
  }
  if (loading)
    return (
      <div className="center">
        <Spinner size="lg" />
      </div>
    );
  if (!profile) return <ErrorMessage message="Profile not found." />;
  const likedPosts = allPosts.filter(
    (p) => (p.post_id ?? p.id) && likedIds.includes(p.post_id ?? p.id!),
  );
  const flat = Object.values(comments).flat();
  return (
    <div className="content-column">
      <ProfileHeader
        profile={profile}
        stats={stats}
        isOwn
        onEdit={() => setEdit(true)}
      />
      <ProfileTabs />
      <ErrorMessage message={error} onClose={() => setError("")} />
      {tab === "posts" && (
        <ProfilePosts
          posts={posts}
          likes={likes}
          comments={comments}
          loggedIn
          onComment={comment}
        />
      )}{" "}
      {tab === "likes" && (
        <ProfileLikes
          posts={likedPosts}
          likes={likes}
          comments={comments}
          loggedIn
          onComment={comment}
        />
      )}{" "}
      {tab === "comments" && (
        <ProfileComments
          comments={
            activity.length
              ? activity
              : flat.filter((c) => c.parent_comment_id == null)
          }
        />
      )}{" "}
      {tab === "replies" && (
        <ProfileReplies
          comments={activity.filter((c) => c.parent_comment_id != null)}
        />
      )}
      <Modal open={edit} title="Edit profile" onClose={() => setEdit(false)}>
        <EditProfile
          profile={profile}
          onCancel={() => setEdit(false)}
          onSaved={(p) => {
            setProfile(p);
            setEdit(false);
          }}
        />
      </Modal>
    </div>
  );
}

import { Avatar } from "../ui/Avatar";
import type { Profile } from "../../types/user";
import type { FollowStats } from "../../types/follow";
import { FollowButton } from "../follows/FollowButton";
export function ProfileHeader({
  profile,
  stats,
  isOwn,
  onEdit,
  onFollow,
}: {
  profile: Profile;
  stats: FollowStats;
  isOwn?: boolean;
  onEdit?: () => void;
  onFollow?: () => void;
}) {
  const name = profile.display_name || profile.username || "User";
  return (
    <section className="profile-header">
      <Avatar size="lg" src={profile.avatar_url} name={name} />
      <div className="profile-main">
        <div className="profile-name-row">
          <div>
            <h1>{name}</h1>
            <p>@{profile.username || "user"}</p>
          </div>
          {isOwn ? (
            <button className="outline-btn" onClick={onEdit}>
              Edit profile
            </button>
          ) : onFollow ? (
            <FollowButton
              userId={profile.user_id ?? profile.id}
              onFollow={onFollow}
            />
          ) : null}
        </div>
        {profile.bio && <p className="bio">{profile.bio}</p>}
        <div className="profile-stats">
          <span>
            <b>{stats.followers_count}</b> followers
          </span>
          <span>
            <b>{stats.following_count}</b> following
          </span>
        </div>
      </div>
    </section>
  );
}

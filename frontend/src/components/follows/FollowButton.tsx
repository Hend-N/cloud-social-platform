import { useEffect, useState } from "react";
import { checkFollowStatus, followUser, unfollowUser } from "../../api/follows";
import { Button } from "../ui/Button";
export function FollowButton({
  userId,
  onFollow,
}: {
  userId?: number;
  onFollow?: () => void;
}) {
  const [following, setFollowing] = useState(false),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    if (userId)
      checkFollowStatus(userId).then((x) => setFollowing(x.is_following));
  }, [userId]);
  async function toggle() {
    if (!userId) return;
    setLoading(true);
    try {
      if (following) {
        await unfollowUser(userId);
        setFollowing(false);
      } else {
        await followUser(userId);
        setFollowing(true);
      }
      onFollow?.();
    } finally {
      setLoading(false);
    }
  }
  return (
    <Button
      variant={following ? "secondary" : "primary"}
      loading={loading}
      onClick={toggle}
    >
      {following ? "Following" : "Follow"}
    </Button>
  );
}

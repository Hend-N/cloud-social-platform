import { useEffect, useState } from "react";
import { checkFollowStatus, followUser, unfollowUser } from "../../api/follows";
import { getApiErrorMessage } from "../../api/errors";
import { Button } from "../ui/Button";

export function FollowButton({
  userId,
  onFollow,
}: {
  userId?: number;
  onFollow?: () => void;
}) {
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setError("");
    checkFollowStatus(userId)
      .then((status) => {
        if (!cancelled) setFollowing(status.is_following);
      })
      .catch((e) => {
        if (!cancelled) setError(getApiErrorMessage(e, "Could not check follow status."));
      });
    return () => { cancelled = true; };
  }, [userId]);

  async function toggle() {
    if (!userId || loading) return;
    setLoading(true);
    setError("");
    try {
      if (following) {
        await unfollowUser(userId);
        setFollowing(false);
      } else {
        await followUser(userId);
        setFollowing(true);
      }
      onFollow?.();
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not update follow status."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="follow-control">
      <Button
        variant={following ? "secondary" : "primary"}
        loading={loading}
        disabled={!userId}
        onClick={toggle}
        type="button"
        aria-label={following ? "Unfollow user" : "Follow user"}
      >
        {following ? "Following" : "Follow"}
      </Button>
      {error && <span className="follow-error" role="alert">{error}</span>}
    </div>
  );
}

import { useEffect, useState } from "react";
import { getFollowing } from "../../api/follows";
import { EmptyState } from "../ui/EmptyState";
import { Spinner } from "../ui/Spinner";

export function FollowingList({ userId }: { userId: number }) {
  const [ids, setIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getFollowing(userId).then((result) => {
      if (!cancelled) {
        setIds(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) return <Spinner size="sm" />;
  if (!ids.length)
    return <EmptyState title="Not following anyone yet" />;

  return (
    <ul className="follow-id-list">
      {ids.map((id) => (
        <li key={id}>User #{id}</li>
      ))}
    </ul>
  );
}

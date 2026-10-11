import { useEffect, useState } from "react";
import { getFollowers } from "../../api/follows";
import { EmptyState } from "../ui/EmptyState";
import { Spinner } from "../ui/Spinner";

export function FollowersList({ userId }: { userId: number }) {
  const [ids, setIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getFollowers(userId).then((result) => {
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
    return <EmptyState title="No followers yet" />;

  return (
    <ul className="follow-id-list">
      {ids.map((id) => (
        <li key={id}>User #{id}</li>
      ))}
    </ul>
  );
}

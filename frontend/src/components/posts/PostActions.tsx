import { useState } from "react";
import { likePost, unlikePost } from "../../api/likes";
import { Button } from "../ui/Button";
export function PostActions({
  postId,
  likeCount,
  loggedIn,
}: {
  postId: number;
  likeCount: number;
  loggedIn: boolean;
}) {
  const [liked, setLiked] = useState(false),
    [count, setCount] = useState(likeCount),
    [loading, setLoading] = useState(false);
  async function toggle() {
    if (!loggedIn) return;
    setLoading(true);
    try {
      if (liked) {
        await unlikePost(postId);
        setLiked(false);
        setCount((c) => Math.max(0, c - 1));
      } else {
        await likePost(postId);
        setLiked(true);
        setCount((c) => c + 1);
      }
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="post-actions">
      <Button
        variant={liked ? "secondary" : "ghost"}
        onClick={toggle}
        disabled={!loggedIn}
        loading={loading}
      >
        {liked ? "Liked" : "Like"} <span>{count}</span>
      </Button>
    </div>
  );
}

import { useEffect, useState } from "react";
import { likePost, unlikePost, getLikeCount } from "../../api/likes";
import { getApiErrorMessage } from "../../api/errors";
import { Button } from "../ui/Button";
import { ErrorMessage } from "../ui/ErrorMessage";

export function PostActions({
  postId,
  loggedIn,
  initiallyLiked = false,
}: {
  postId: number;
  loggedIn: boolean;
  initiallyLiked?: boolean;
}) {
  const [liked, setLiked] = useState(initiallyLiked);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLiked(initiallyLiked);
  }, [initiallyLiked]);

  // The server is the source of truth for the count.
  useEffect(() => {
    let cancelled = false;
    getLikeCount(postId)
      .then((n: number) => {
        if (!cancelled) setCount(n);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [postId]);

  async function set(next: boolean) {
    if (!loggedIn || busy) return;
    setBusy(true);
    setError("");
    try {
      if (next) await likePost(postId);
      else await unlikePost(postId);
      setLiked(next);
      setCount(await getLikeCount(postId));
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not update your like."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="post-actions">
      <div className="like-count" aria-label={`${count} likes`}>
        <span className="heart" aria-hidden="true">
          ♥
        </span>
        <span>{count}</span>
      </div>
      <div className="like-buttons">
        <Button
          variant="secondary"
          onClick={() => set(true)}
          disabled={!loggedIn || liked || busy}
        >
          👍 Like
        </Button>
        <Button
          variant="secondary"
          onClick={() => set(false)}
          disabled={!loggedIn || !liked || busy}
        >
          Unlike
        </Button>
      </div>
      <ErrorMessage message={error} />
    </div>
  );
}

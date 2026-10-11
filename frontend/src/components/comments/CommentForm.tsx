import { useState } from "react";
import { Button } from "../ui/Button";
import { ErrorMessage } from "../ui/ErrorMessage";
import { getApiErrorMessage } from "../../api/errors";

export const COMMENT_MAX_LENGTH = 300; // matches the comment-service limit

export function CommentForm({
  onSubmit,
  placeholder = "Add a comment…",
  submitLabel = "Send",
  initialValue = "",
  onCancel,
}: {
  onSubmit: (text: string) => Promise<void>;
  placeholder?: string;
  submitLabel?: string;
  initialValue?: string;
  onCancel?: () => void;
}) {
  const [v, setV] = useState(initialValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = v.trim();
    if (!text) return;
    setLoading(true);
    setError("");
    try {
      await onSubmit(text);
      setV("");
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not save your comment."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="comment-form" onSubmit={submit}>
      <div className="comment-form-row">
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder={placeholder}
          maxLength={COMMENT_MAX_LENGTH}
          aria-label={placeholder}
        />
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={loading} disabled={!v.trim()}>
          {submitLabel}
        </Button>
      </div>
      <ErrorMessage message={error} />
    </form>
  );
}

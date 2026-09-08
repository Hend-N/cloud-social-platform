import { useState } from "react";
import { Button } from "../ui/Button";
export function CommentForm({
  onSubmit,
  placeholder = "Add a comment…",
}: {
  onSubmit: (text: string) => Promise<void>;
  placeholder?: string;
}) {
  const [v, setV] = useState(""),
    [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.trim()) return;
    setLoading(true);
    try {
      await onSubmit(v.trim());
      setV("");
    } finally {
      setLoading(false);
    }
  }
  return (
    <form className="comment-form" onSubmit={submit}>
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={placeholder}
      />
      <Button
        type="submit"
        variant="secondary"
        loading={loading}
        disabled={!v.trim()}
      >
        Send
      </Button>
    </form>
  );
}

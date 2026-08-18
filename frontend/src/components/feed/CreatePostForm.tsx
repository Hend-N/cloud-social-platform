import { useState } from "react";
import type { FormEvent } from "react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { LoadingSpinner } from "../ui/LoadingSpinner";

type CreatePostFormProps = {
  onPostCreated: (content: string) => Promise<void>;
};

export function CreatePostForm({ onPostCreated }: CreatePostFormProps) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onPostCreated(content);
      setContent("");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card style={{ marginBottom: "24px" }}>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "12px" }}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's happening?"
          rows={3}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid var(--color-border, #334155)",
            background: "rgba(15, 23, 42, 0.6)",
            color: "inherit",
            fontFamily: "inherit",
            resize: "vertical",
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button type="submit" disabled={isSubmitting || !content.trim()}>
            {isSubmitting ? <LoadingSpinner size="sm" /> : "Post"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
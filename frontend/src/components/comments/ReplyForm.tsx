import { CommentForm } from "./CommentForm";
export function ReplyForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (text: string) => Promise<void>;
  onCancel?: () => void;
}) {
  return (
    <CommentForm
      onSubmit={onSubmit}
      onCancel={onCancel}
      placeholder="Write a reply…"
      submitLabel="Reply"
    />
  );
}

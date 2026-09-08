import { CommentForm } from "./CommentForm";
export function ReplyForm({
  onSubmit,
}: {
  onSubmit: (text: string) => Promise<void>;
}) {
  return <CommentForm onSubmit={onSubmit} placeholder="Write a reply…" />;
}

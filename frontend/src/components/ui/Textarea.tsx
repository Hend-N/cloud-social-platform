import type { TextareaHTMLAttributes } from "react";
export function Textarea({
  label,
  ...p
}: { label?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="field">
      {label && <span>{label}</span>}
      <textarea {...p} />
    </label>
  );
}

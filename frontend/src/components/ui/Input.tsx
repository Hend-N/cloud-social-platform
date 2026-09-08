import type { InputHTMLAttributes } from "react";
export function Input({
  label,
  error,
  ...p
}: { label?: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="field">
      {label && <span>{label}</span>}
      <input {...p} />
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

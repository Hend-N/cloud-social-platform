import type { ButtonHTMLAttributes } from "react";
export function Button({
  variant = "primary",
  loading = false,
  children,
  ...p
}: {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`ui-button ${variant}`}
      disabled={loading || p.disabled}
      {...p}
    >
      {loading ? <span className="button-spinner" /> : null}
      {children}
    </button>
  );
}

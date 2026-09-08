export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return <span className={`spinner spinner-${size}`} aria-label="Loading" />;
}

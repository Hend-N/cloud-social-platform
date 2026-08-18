import "./LoadingSpinner.css";

type LoadingSpinnerProps = {
  size?: "sm" | "md" | "lg";
};

export function LoadingSpinner({ size = "md" }: LoadingSpinnerProps) {
  return <div className={`spinner spinner-${size}`} aria-label="Loading..." />;
}
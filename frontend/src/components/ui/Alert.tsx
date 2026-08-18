import { useEffect } from "react";

interface AlertProps {
  message: string;
  type?: "info" | "error" | "success";
  duration?: number; 
  onClose?: () => void;
}

export function Alert({
  message,
  type = "info",
  duration = 5000,
  onClose,
}: AlertProps) {
  useEffect(() => {
    if (!message || !onClose) return;

    const timer = setTimeout(() => {
      onClose();
    }, duration);

    // Cleanup timer if component unmounts or message changes
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  return (
    <div className={`alert alert-${type}`}>
      <span>{message}</span>
    </div>
  );
}
import "./Alert.css";

type AlertType = "error" | "info" | "success";

type AlertProps = {
  message: string;
  type?: AlertType;
  onClose?: () => void;
};

const ICONS: Record<AlertType, string> = {
  error: "⚠️",
  info: "ℹ️",
  success: "✅",
};

export function Alert({ message, type = "info", onClose }: AlertProps) {
  return (
    <div className={`alert alert-${type}`} role="alert">
      <span className="alert-icon" aria-hidden="true">
        {ICONS[type]}
      </span>
      <span className="alert-message">{message}</span>
      {onClose && (
        <button type="button" className="alert-close" onClick={onClose} aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}

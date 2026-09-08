export function ErrorMessage({
  message,
  onClose,
}: {
  message: string;
  onClose?: () => void;
}) {
  if (!message) return null;
  return (
    <div className="error-message" role="alert">
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}

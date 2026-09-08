export function Avatar({
  src,
  name = "User",
  size = "md",
}: {
  src?: string;
  name?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div className={`avatar avatar-${size}`}>
      {src ? (
        <img src={src} alt={name} />
      ) : (
        <span>{name.trim().charAt(0).toUpperCase() || "U"}</span>
      )}
    </div>
  );
}

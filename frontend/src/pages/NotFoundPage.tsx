import { Link } from "react-router-dom";
export function NotFoundPage() {
  return (
    <div className="not-found">
      <h1>404</h1>
      <p>That page doesn't exist.</p>
      <Link to="/feed">Back to feed</Link>
    </div>
  );
}

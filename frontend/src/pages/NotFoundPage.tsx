import { Link } from "react-router-dom";
export function NotFoundPage() {
  return (
    <div className="empty-state">
      <div className="eyebrow">404</div>
      <h1>Page not found</h1>
      <p>The page you requested doesn’t exist.</p>
      <Link className="ui-button primary" to="/feed">
        Back to feed
      </Link>
    </div>
  );
}

import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="content-narrow mx-auto py-16 text-center">
      <p className="font-serif text-6xl font-bold text-[var(--primary)]">404</p>
      <h1 className="page-title mt-4">Page not found</h1>
      <p className="page-sub">The page you're looking for doesn't exist or has moved.</p>
      <Link to="/" className="btn btn-primary mt-6">
        Back to Home
      </Link>
    </div>
  );
}

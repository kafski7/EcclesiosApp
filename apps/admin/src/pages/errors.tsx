import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main className="cms-auth">
      <div className="card cms-auth-card empty">
        <h2>Page not found</h2>
        <p>The page you're looking for doesn't exist or has moved.</p>
        <Link to="/" className="btn btn-primary btn-sm">
          Go home
        </Link>
      </div>
    </main>
  );
}

/** Router error boundary — the CMS "500" page. */
export function ErrorPage() {
  const err = useRouteError();
  if (isRouteErrorResponse(err) && err.status === 404) return <NotFoundPage />;
  return (
    <main className="cms-auth">
      <div className="card cms-auth-card empty">
        <h2>Something went wrong</h2>
        <p>Please reload the page. If it keeps happening, contact Ecclesios support.</p>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    </main>
  );
}

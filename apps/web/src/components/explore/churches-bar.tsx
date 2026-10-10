import { Church, Home, MapPin, Search, Star, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CHURCH_SEARCH_MIN, churchPlace, myChurches, useChurchSearch } from "@/lib/churches";
import { useMe } from "@/lib/me";

/**
 * Explore's churches row (docs/social.md §9.4, D-044): shortcuts to the member's own churches,
 * and "Find a church" — a public search of parishes and outstations that opens their page.
 */
export function ChurchesBar() {
  const me = useMe();
  const mine = myChurches(me.data);
  // "/explore?find=1" (from "Your churches") opens the finder straight away (D-049).
  const [params] = useSearchParams();
  const [open, setOpen] = useState(params.get("find") === "1");
  const panelId = useId();

  return (
    <div className="churches-bar">
      <div className="churches-row" role="group" aria-label="Churches">
        {mine.map((c) => (
          <Link
            key={c.id}
            to={`/explore/churches/${c.id}`}
            className="f-pill church-pill"
            title={WHY[c.why]}
          >
            {c.why === "home" ? (
              <Home className="ic" aria-hidden />
            ) : c.why === "follow" ? (
              <Star className="ic" aria-hidden />
            ) : (
              <Church className="ic" aria-hidden />
            )}
            <span className="sr-only">{WHY[c.why]}: </span>
            {c.name}
          </Link>
        ))}
        <button
          type="button"
          className="f-pill church-find"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="ic" aria-hidden /> : <Search className="ic" aria-hidden />}
          {open ? "Close" : "Find a church"}
        </button>
      </div>
      {open ? <FindChurch id={panelId} /> : null}
    </div>
  );
}

const WHY = { home: "Your home church", member: "Your church", follow: "Following" } as const;

function FindChurch({ id }: { id: string }) {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  const r = useChurchSearch(term);
  const short = term.trim().length < CHURCH_SEARCH_MIN;
  const items = r.data?.items ?? [];

  return (
    <section id={id} className="card rail-card find-church" aria-label="Find a church">
      <label className="search">
        <MapPin className="ic" aria-hidden />
        <input
          type="search"
          autoFocus
          placeholder="Parish or outstation name, or a town"
          aria-label="Find a church"
          maxLength={100}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      <div aria-live="polite">
        {short ? (
          <p className="small muted">Type at least {CHURCH_SEARCH_MIN} letters.</p>
        ) : r.isPending ? (
          <p className="small muted">Searching…</p>
        ) : r.isError ? (
          <p className="small muted">
            The search could not be completed.{" "}
            <button type="button" className="link" onClick={() => void r.refetch()}>
              Try again
            </button>
          </p>
        ) : !items.length ? (
          <p className="small muted">No churches found.</p>
        ) : (
          <ul className="search-hits">
            {items.map((c) => (
              <li key={c.id}>
                <Link to={`/explore/churches/${c.id}`}>
                  <b>{c.name}</b>
                  <p className="small muted" style={{ margin: 0 }}>
                    {churchPlace(c)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

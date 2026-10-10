import { Bell, BellOff, Church, Compass, Pencil } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { PostCard } from "@/components/cards";
import { JoinButton } from "@/components/explore/join-button";
import { EmptyState, ErrorState, LoadMore, Skeleton } from "@/components/ui/states";
import { ApiClientError } from "@/lib/api";
import { useChurch, useFeed, useFollowChurch, useSaveChurch } from "@/lib/explore";
import { useMe } from "@/lib/me";
import type { ChurchProfile } from "@ecclesios/shared";
import { useSession } from "@/stores/session";

/** A church's page (D-031): profile, join (D-049), follow, and its approved posts. */
export function ExploreChurchPage() {
  const { id } = useParams();
  const church = useChurch(id);
  const feed = useFeed("ALL", "", id);
  const principal = useSession((s) => s.principal);
  const me = useMe();
  const follow = useFollowChurch(id ?? "");
  const [editing, setEditing] = useState(false);
  if (church.isPending) return <Skeleton variant="page" label="Loading the church" />;
  if (church.isError)
    return church.error instanceof ApiClientError && church.error.status === 404 ? (
      <EmptyState
        icon={Church}
        title="We couldn't find that church"
        action={
          <Link to="/explore" className="btn btn-outline btn-sm">
            Back to Explore
          </Link>
        }
      />
    ) : (
      <ErrorState
        title="This church page could not be loaded"
        error={church.error}
        onRetry={() => church.refetch()}
        retrying={church.isRefetching}
      />
    );
  const c = church.data;
  const following = !!me.data?.follows.some((f) => f.id === c.id);
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div style={{ maxWidth: 1060, margin: "0 auto" }}>
      <section className="card church-hero">
        <div className="cover">{c.coverUrl ? <img src={c.coverUrl} alt="" /> : null}</div>
        <div className="body">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="page-title">{c.name}</h1>
              <p className="page-sub">{c.context}</p>
              <p className="small muted mt-1">
                {c.followers} follower{c.followers === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <JoinButton churchId={c.id} churchName={c.name} />
              {principal?.kind === "member" ? (
                <button
                  type="button"
                  className={`btn btn-sm ${following ? "btn-outline" : "btn-primary"}`}
                  aria-pressed={following}
                  disabled={follow.isPending || me.isPending}
                  onClick={() => follow.mutate(!following)}
                >
                  {following ? (
                    <BellOff className="ic" aria-hidden />
                  ) : (
                    <Bell className="ic" aria-hidden />
                  )}
                  {following ? "Following" : "Follow"}
                </button>
              ) : null}
              {c.canManage ? (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setEditing((e) => !e)}
                >
                  <Pencil className="ic" aria-hidden /> {editing ? "Close" : "Edit page"}
                </button>
              ) : null}
            </div>
          </div>
          {editing ? (
            <EditChurch c={c} onDone={() => setEditing(false)} />
          ) : (
            <>
              {c.about ? (
                <p className="mt-4" style={{ color: "var(--text-2)", whiteSpace: "pre-line" }}>
                  {c.about}
                </p>
              ) : null}
              <dl className="church-facts">
                {c.massTimes ? <Fact label="Mass times" value={c.massTimes} /> : null}
                {c.address ? <Fact label="Address" value={c.address} /> : null}
                {c.phone ? <Fact label="Phone" value={c.phone} /> : null}
                {c.website ? (
                  <div>
                    <dt>Website</dt>
                    <dd>
                      <a
                        className="link"
                        href={c.website}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {c.website.replace(/^https?:\/\//, "")}
                      </a>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </>
          )}
        </div>
      </section>

      <div className="flex items-center justify-between mt-6 mb-3">
        <h2 className="rail-title">Posts</h2>
        {c.canManage ? (
          <Link to="/explore/write" className="link">
            Write a post
          </Link>
        ) : null}
      </div>
      {feed.isPending ? <Skeleton variant="cards" count={2} label="Loading posts" /> : null}
      {feed.isError ? (
        <ErrorState
          title="The posts could not be loaded"
          error={feed.error}
          onRetry={() => feed.refetch()}
          retrying={feed.isRefetching}
          compact
        />
      ) : null}
      {feed.isSuccess && !items.length ? (
        <EmptyState icon={Compass} title="No posts yet" compact />
      ) : null}
      <div className="explore-grid">
        {items.map((p) => (
          <PostCard key={p.id} p={p} />
        ))}
      </div>
      <LoadMore q={feed} label="More posts" />
    </div>
  );
}

const Fact = ({ label, value }: { label: string; value: string }) => (
  <div>
    <dt>{label}</dt>
    <dd>{value}</dd>
  </div>
);

function EditChurch({ c, onDone }: { c: ChurchProfile; onDone: () => void }) {
  const save = useSaveChurch(c.id);
  const [f, setF] = useState({
    about: c.about,
    address: c.address ?? "",
    massTimes: c.massTimes ?? "",
    phone: c.phone ?? "",
    website: c.website ?? "",
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((x) => ({ ...x, [k]: e.target.value }));
  const nul = (s: string) => (s.trim() ? s.trim() : null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(
      {
        about: f.about,
        address: nul(f.address),
        massTimes: nul(f.massTimes),
        phone: nul(f.phone),
        website: nul(f.website),
      },
      { onSuccess: onDone },
    );
  };
  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
      <label>
        <span className="field-label">About</span>
        <textarea
          className="field-input"
          style={{ minHeight: 100, fontFamily: "inherit" }}
          value={f.about}
          onChange={set("about")}
          maxLength={3000}
        />
      </label>
      <label>
        <span className="field-label">Mass times</span>
        <textarea
          className="field-input"
          style={{ minHeight: 80, fontFamily: "inherit" }}
          value={f.massTimes}
          onChange={set("massTimes")}
          maxLength={1000}
        />
      </label>
      <label>
        <span className="field-label">Address</span>
        <input
          className="field-input"
          value={f.address}
          onChange={set("address")}
          maxLength={300}
        />
      </label>
      <div className="flex gap-3 flex-wrap">
        <label className="flex-1">
          <span className="field-label">Phone</span>
          <input className="field-input" value={f.phone} onChange={set("phone")} maxLength={40} />
        </label>
        <label className="flex-1">
          <span className="field-label">Website</span>
          <input
            className="field-input"
            type="url"
            placeholder="https://"
            value={f.website}
            onChange={set("website")}
          />
        </label>
      </div>
      {save.error ? (
        <p className="small" style={{ color: "var(--danger)" }}>
          {save.error instanceof ApiClientError ? save.error.message : "Could not save."}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary btn-sm" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

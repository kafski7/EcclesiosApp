import { CAlert, CBadge, CButton, CForm, CFormCheck, CFormInput, CFormLabel, CFormSelect, CFormText, CFormTextarea } from "@coreui/react";
import type { StudioPodcast } from "@ecclesios/shared";
import { formatEpisodeDuration, publishBlocker, type EpisodeMediaKind } from "@ecclesios/shared/domain";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiClientError } from "@/lib/api";
import { authErrorMessage } from "@/lib/auth-errors";
import {
  handoutLabel,
  isCoverType,
  useAddEpisode,
  useAddHandout,
  useEpisodeStatus,
  useRemoveEpisode,
  useRemoveHandout,
  useSavePodcast,
  useSetYouTube,
  useStudioPodcast,
  useUpdateEpisode,
  useUploadAudio,
  useUploadCover,
} from "@/lib/podcasts";

const errText = (e: unknown) =>
  e instanceof ApiClientError ? (e.code.startsWith("HTTP_") ? authErrorMessage(e) : e.message) : e instanceof Error ? e.message : "Something went wrong.";

/** Create / edit a series and its episodes (D-027). */
export function PodcastEditPage() {
  const { slug } = useParams();
  const isNew = !slug || slug === "new";
  const q = useStudioPodcast(isNew ? undefined : slug);
  if (!isNew && q.isPending) return <p className="muted">Loading…</p>;
  if (!isNew && q.isError) return <CAlert color="danger">{errText(q.error)}</CAlert>;
  return (
    <>
      <Link to="/platform/podcasts" className="link mb-3 d-inline-block">← All podcasts</Link>
      <SeriesForm podcast={isNew ? null : q.data!} />
      {!isNew && q.data ? (
        <>
          <CoverPanel podcast={q.data} />
          <Episodes podcast={q.data} />
        </>
      ) : null}
    </>
  );
}

function SeriesForm({ podcast }: { podcast: StudioPodcast | null }) {
  const navigate = useNavigate();
  const save = useSavePodcast(podcast?.slug);
  const [title, setTitle] = useState(podcast?.title ?? "");
  const [summary, setSummary] = useState(podcast?.summary ?? "");
  const [description, setDescription] = useState(podcast?.description ?? "");
  const [category, setCategory] = useState(podcast?.category ?? "");
  const [published, setPublished] = useState(podcast?.isPublished ?? true);
  useEffect(() => {
    if (save.data && !podcast) navigate(`/platform/podcasts/${save.data.slug}`, { replace: true });
  }, [save.data, podcast, navigate]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate({ title, summary, description, category: category.trim() || null, isPublished: published });
  };
  return (
    <section className="card panel mb-4">
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>{podcast ? podcast.title : "New series"}</h1>
      {podcast ? <p className="small muted">{podcast.followers} follower{podcast.followers === 1 ? "" : "s"}</p> : null}
      {save.error ? <CAlert color="danger">{errText(save.error)}</CAlert> : null}
      {save.isSuccess && podcast ? <CAlert color="success">Saved.</CAlert> : null}
      <CForm onSubmit={submit}>
        <div className="mb-3">
          <CFormLabel htmlFor="pt">Title</CFormLabel>
          <CFormInput id="pt" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="mb-3">
          <CFormLabel htmlFor="ps">One-line summary</CFormLabel>
          <CFormInput id="ps" value={summary} maxLength={280} onChange={(e) => setSummary(e.target.value)} required />
        </div>
        <div className="mb-3">
          <CFormLabel htmlFor="pd">About this podcast</CFormLabel>
          <CFormTextarea id="pd" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="mb-3">
          <CFormLabel htmlFor="pc">Category</CFormLabel>
          <CFormInput id="pc" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="reflection, youth, catechesis…" />
        </div>
        <CFormCheck id="pp" label="Visible to listeners" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        <CButton type="submit" color="primary" className="mt-3" disabled={save.isPending}>
          {save.isPending ? "Saving…" : podcast ? "Save changes" : "Create series"}
        </CButton>
      </CForm>
    </section>
  );
}

function CoverPanel({ podcast }: { podcast: StudioPodcast }) {
  const upload = useUploadCover(podcast.slug);
  const [bad, setBad] = useState(false);
  return (
    <section className="card panel mb-4 d-flex gap-4 align-items-center flex-wrap">
      {podcast.coverUrl ? (
        <img src={podcast.coverUrl} alt="" style={{ width: 96, height: 96, borderRadius: 14, objectFit: "cover" }} />
      ) : (
        <span className="small muted">No cover image</span>
      )}
      <div>
        <CFormLabel htmlFor="cover">Cover image (square, JPEG/PNG/WebP, max 5 MB)</CFormLabel>
        <CFormInput
          id="cover"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBad(!isCoverType(f.type));
            if (isCoverType(f.type)) upload.mutate(f);
          }}
        />
        {podcast.coverUrl ? (
          <CButton size="sm" color="danger" variant="ghost" className="mt-2" onClick={() => upload.mutate(null)}>
            Remove cover
          </CButton>
        ) : null}
        {bad ? <CFormText className="text-danger">Use a JPEG, PNG or WebP image.</CFormText> : null}
        {upload.isPending ? <CFormText>Uploading…</CFormText> : null}
        {upload.error ? <CAlert color="danger" className="mt-2">{errText(upload.error)}</CAlert> : null}
      </div>
    </section>
  );
}

function Episodes({ podcast }: { podcast: StudioPodcast }) {
  const add = useAddEpisode(podcast.slug);
  const [title, setTitle] = useState("");
  const [number, setNumber] = useState("");
  const next = Math.max(0, ...podcast.episodes.map((e) => e.number ?? 0)) + 1;
  return (
    <section className="card panel">
      <h2 className="panel-title mb-3">Episodes</h2>
      <CForm
        className="d-flex gap-2 flex-wrap mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim())
            add.mutate(
              { title: title.trim(), notes: "", number: number ? Number(number) : next, mediaKind: "AUDIO", access: "FREE", transcript: "" },
              { onSuccess: () => { setTitle(""); setNumber(""); } },
            );
        }}
      >
        <CFormInput style={{ maxWidth: 90 }} type="number" min={1} placeholder={String(next)} aria-label="Episode number" value={number} onChange={(e) => setNumber(e.target.value)} />
        <CFormInput style={{ flex: 1, minWidth: 220 }} placeholder="New episode title" aria-label="New episode title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <CButton type="submit" color="primary" disabled={add.isPending || title.trim().length < 2}>Add draft</CButton>
      </CForm>
      {add.error ? <CAlert color="danger">{errText(add.error)}</CAlert> : null}
      {podcast.episodes.length ? (
        podcast.episodes.map((e) => <EpisodeCard key={e.id} slug={podcast.slug} e={e} />)
      ) : (
        <p className="small muted">No episodes yet.</p>
      )}
    </section>
  );
}

const BLOCKER_TEXT = {
  AUDIO_REQUIRED: "Upload audio first",
  YOUTUBE_REQUIRED: "Add the YouTube link first",
  VIDEO_NOT_AVAILABLE: "Hosted video isn't available yet",
} as const;

function EpisodeCard({ slug, e }: { slug: string; e: StudioPodcast["episodes"][number] }) {
  const update = useUpdateEpisode(slug);
  const status = useEpisodeStatus(slug);
  const remove = useRemoveEpisode(slug);
  const upload = useUploadAudio(slug);
  const yt = useSetYouTube(slug);
  const addHandout = useAddHandout(slug);
  const delHandout = useRemoveHandout(slug);
  const [title, setTitle] = useState(e.title);
  const [notes, setNotes] = useState(e.notes);
  const [number, setNumber] = useState(e.number ? String(e.number) : "");
  const [mediaKind, setMediaKind] = useState<EpisodeMediaKind>(e.mediaKind);
  const [access, setAccess] = useState(e.access);
  const [transcript, setTranscript] = useState(e.transcript);
  const [link, setLink] = useState(e.youtubeId ? `https://youtu.be/${e.youtubeId}` : "");
  const err = update.error ?? status.error ?? remove.error ?? upload.error ?? yt.error ?? addHandout.error ?? delHandout.error;
  const live = e.status === "PUBLISHED";
  const blocker = publishBlocker({ mediaKind: e.mediaKind, audioKey: e.hasAudio ? "x" : null, youtubeId: e.youtubeId });

  const save = () =>
    update.mutate({ id: e.id, body: { title, notes, number: number ? Number(number) : null, mediaKind, access, transcript } });

  return (
    <div className="card p-3 mb-3">
      <div className="d-flex gap-2 align-items-center flex-wrap mb-2">
        {live ? <CBadge color="success">Published</CBadge> : <CBadge color="secondary">Draft</CBadge>}
        <span className="small muted">{e.mediaKind === "YOUTUBE" ? "Leads with YouTube" : "Leads with audio"}</span>
        {e.hasAudio ? <span className="small muted">· Audio {formatEpisodeDuration(e.durationSec)}</span> : null}
        {e.youtubeId ? <span className="small muted">· YouTube</span> : null}
        {e.access === "SUBSCRIBER" ? <CBadge color="warning">Subscribers</CBadge> : null}
        <span className="ms-auto d-flex gap-2">
          <CButton
            size="sm"
            color={live ? "secondary" : "primary"}
            variant={live ? "outline" : undefined}
            disabled={status.isPending || (!live && blocker !== null)}
            title={!live && blocker ? BLOCKER_TEXT[blocker] : undefined}
            onClick={() => status.mutate({ id: e.id, status: live ? "DRAFT" : "PUBLISHED" })}
          >
            {live ? "Unpublish" : "Publish"}
          </CButton>
          <CButton size="sm" color="danger" variant="ghost" onClick={() => confirm(`Delete "${e.title}" and its files?`) && remove.mutate(e.id)}>
            Delete
          </CButton>
        </span>
      </div>
      {!live && blocker ? <p className="small text-danger mb-2">{BLOCKER_TEXT[blocker]} to publish.</p> : null}

      <div className="d-flex gap-2 mb-2">
        <CFormInput style={{ maxWidth: 90 }} type="number" min={1} aria-label="Number" value={number} onChange={(x) => setNumber(x.target.value)} />
        <CFormInput aria-label="Title" value={title} onChange={(x) => setTitle(x.target.value)} />
      </div>
      <CFormTextarea rows={3} aria-label="Show notes" placeholder="Show notes" value={notes} onChange={(x) => setNotes(x.target.value)} className="mb-2" />
      <div className="row g-2 mb-2">
        <div className="col-md-4">
          <CFormLabel className="small mb-1">Leads with</CFormLabel>
          <CFormSelect size="sm" value={mediaKind} onChange={(x) => setMediaKind(x.target.value as EpisodeMediaKind)}>
            <option value="AUDIO">Audio (uploaded)</option>
            <option value="YOUTUBE">YouTube video</option>
            <option value="VIDEO" disabled>
              Hosted video — coming later
            </option>
          </CFormSelect>
        </div>
        <div className="col-md-4">
          <CFormLabel className="small mb-1">Who can listen</CFormLabel>
          <CFormSelect size="sm" value={access} onChange={(x) => setAccess(x.target.value as "FREE" | "SUBSCRIBER")}>
            <option value="FREE">Everyone</option>
            <option value="SUBSCRIBER">Subscribers</option>
          </CFormSelect>
          <CFormText>Open to everyone until listener subscriptions launch.</CFormText>
        </div>
      </div>
      <details className="mb-2">
        <summary className="small">Transcript {e.transcript ? "(added)" : ""}</summary>
        <CFormTextarea rows={6} className="mt-2" aria-label="Transcript" value={transcript} onChange={(x) => setTranscript(x.target.value)} />
      </details>
      <CButton size="sm" color="primary" variant="outline" disabled={update.isPending} onClick={save} className="mb-3">
        Save details
      </CButton>

      <div className="d-flex gap-2 align-items-center flex-wrap mb-2">
        <CFormLabel className="small mb-0" style={{ minWidth: 70 }}>Audio</CFormLabel>
        <CFormInput
          size="sm"
          type="file"
          accept="audio/mpeg,audio/mp4,audio/aac,audio/ogg,.mp3,.m4a"
          style={{ maxWidth: 320 }}
          aria-label={e.hasAudio ? "Replace audio" : "Upload audio"}
          onChange={(x) => {
            const f = x.target.files?.[0];
            if (f) upload.mutate({ id: e.id, file: f });
          }}
        />
        {upload.isPending ? <span className="small muted">Uploading…</span> : null}
        {e.audioUrl ? <audio src={e.audioUrl} controls preload="none" style={{ height: 32 }} /> : null}
      </div>
      <CForm
        className="d-flex gap-2 align-items-center flex-wrap mb-2"
        onSubmit={(x) => {
          x.preventDefault();
          yt.mutate({ id: e.id, url: link.trim() || null });
        }}
      >
        <CFormLabel className="small mb-0" style={{ minWidth: 70 }}>YouTube</CFormLabel>
        <CFormInput size="sm" style={{ maxWidth: 320 }} placeholder="https://youtu.be/… or music.youtube.com/…" aria-label="YouTube link" value={link} onChange={(x) => setLink(x.target.value)} />
        <CButton size="sm" type="submit" color="primary" variant="outline" disabled={yt.isPending}>
          {link.trim() ? "Save link" : "Remove link"}
        </CButton>
      </CForm>
      <div className="d-flex gap-2 align-items-center flex-wrap">
        <CFormLabel className="small mb-0" style={{ minWidth: 70 }}>Handouts</CFormLabel>
        {e.attachments.map((a) => (
          <span key={a.id} className="badge text-bg-light border d-inline-flex align-items-center gap-1">
            {a.label}
            <button type="button" className="btn-close" style={{ fontSize: 8 }} aria-label={`Remove ${a.label}`} onClick={() => confirm(`Remove ${a.label}?`) && delHandout.mutate(a.id)} />
          </span>
        ))}
        <CFormInput
          size="sm"
          type="file"
          accept="application/pdf,.pdf"
          style={{ maxWidth: 260 }}
          aria-label="Add a PDF handout"
          onChange={(x) => {
            const f = x.target.files?.[0];
            if (f) addHandout.mutate({ id: e.id, file: f, label: handoutLabel(f.name) });
            x.target.value = "";
          }}
        />
        {addHandout.isPending ? <span className="small muted">Uploading…</span> : null}
      </div>
      {err ? <CAlert color="danger" className="mt-2 mb-0">{errText(err)}</CAlert> : null}
    </div>
  );
}

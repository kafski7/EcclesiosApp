import {
  CAlert,
  CButton,
  CForm,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormText,
  CFormTextarea,
} from "@coreui/react";
import type { AdminHymn } from "@ecclesios/shared";
import { defaultMediaAccess, type MediaKind } from "@ecclesios/shared/domain";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiClientError } from "@/lib/api";
import { authErrorMessage } from "@/lib/auth-errors";
import {
  parseNumbers,
  useAddLink,
  useAddTune,
  useAdminHymn,
  useRemoveMedia,
  useRemoveTune,
  useSaveHymn,
  useUpdateMedia,
  useUpdateTune,
  useUploadMedia,
  versesFromText,
  versesToText,
} from "@/lib/hymnal";

const errText = (e: unknown) =>
  e instanceof ApiClientError
    ? e.code.startsWith("HTTP_")
      ? authErrorMessage(e)
      : e.message
    : e instanceof Error
      ? e.message
      : "Something went wrong.";

/** Create / edit one hymn: words, book numbers, tags, tunes and media (D-026). */
export function HymnEditPage() {
  const { slug } = useParams();
  const isNew = !slug || slug === "new";
  const q = useAdminHymn(isNew ? undefined : slug);
  if (!isNew && q.isPending) return <p>Loading…</p>;
  if (!isNew && q.isError) return <CAlert color="danger">This hymn could not be loaded.</CAlert>;
  return (
    <>
      <p className="mb-2">
        <Link to="/platform/hymnal">← All hymns</Link>
      </p>
      <HymnForm hymn={isNew ? null : q.data!} />
      {!isNew && q.data ? <Tunes hymn={q.data} /> : null}
    </>
  );
}

function HymnForm({ hymn }: { hymn: AdminHymn | null }) {
  const navigate = useNavigate();
  const save = useSaveHymn(hymn?.slug);
  const [title, setTitle] = useState(hymn && hymn.title !== hymn.firstLine ? hymn.title : "");
  const [firstLine, setFirstLine] = useState(hymn?.firstLine ?? "");
  const [author, setAuthor] = useState(hymn?.author ?? "");
  const [numbers, setNumbers] = useState(
    hymn?.numbers.map((n) => `${n.book} ${n.number}`).join(", ") ?? "",
  );
  const [tags, setTags] = useState(hymn?.tags.join(", ") ?? "");
  const [words, setWords] = useState(hymn ? versesToText(hymn.verses) : "");
  const [source, setSource] = useState(hymn?.source ?? "");
  const [published, setPublished] = useState(hymn?.isPublished ?? true);
  const parsedNums = parseNumbers(numbers);
  const verses = versesFromText(words);

  useEffect(() => {
    if (save.data && !hymn) navigate(`/platform/hymnal/${save.data.slug}`, { replace: true });
  }, [save.data, hymn, navigate]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate({
      title: title.trim() || null,
      firstLine: firstLine.trim() || verses[0]?.lines[0] || "",
      author: author.trim() || null,
      verses,
      numbers: parsedNums.numbers,
      tags: tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      source: source.trim() || null,
      isPublished: published,
    });
  };

  return (
    <div className="card panel mb-4">
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>{hymn ? hymn.title : "New hymn"}</h1>
      <CForm onSubmit={submit} className="mt-3">
        {save.error ? <CAlert color="danger">{errText(save.error)}</CAlert> : null}
        {save.isSuccess && hymn ? <CAlert color="success">Saved.</CAlert> : null}
        <div className="row g-3">
          <div className="col-md-6">
            <CFormLabel htmlFor="fl">First line</CFormLabel>
            <CFormInput
              id="fl"
              value={firstLine}
              onChange={(e) => setFirstLine(e.target.value)}
              required
            />
          </div>
          <div className="col-md-6">
            <CFormLabel htmlFor="tt">Title (optional)</CFormLabel>
            <CFormInput
              id="tt"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Leave empty to use the first line"
            />
          </div>
          <div className="col-md-6">
            <CFormLabel htmlFor="nums">Hymn book numbers</CFormLabel>
            <CFormInput
              id="nums"
              value={numbers}
              onChange={(e) => setNumbers(e.target.value)}
              placeholder="NCH 56, CH 12"
              invalid={parsedNums.bad.length > 0}
            />
            <CFormText>
              {parsedNums.bad.length
                ? `Not understood: ${parsedNums.bad.join(", ")}`
                : "Book code and number, separated by commas."}
            </CFormText>
          </div>
          <div className="col-md-6">
            <CFormLabel htmlFor="tags">Seasons and occasions</CFormLabel>
            <CFormInput
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="christmas, entrance"
            />
          </div>
          <div className="col-md-6">
            <CFormLabel htmlFor="au">Words by</CFormLabel>
            <CFormInput id="au" value={author} onChange={(e) => setAuthor(e.target.value)} />
          </div>
          <div className="col-md-6">
            <CFormLabel htmlFor="src">Source / permission</CFormLabel>
            <CFormInput
              id="src"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Public domain · or · Used with permission of …"
            />
          </div>
          <div className="col-12">
            <CFormLabel htmlFor="words">Words</CFormLabel>
            <CFormTextarea
              id="words"
              rows={12}
              value={words}
              onChange={(e) => setWords(e.target.value)}
            />
            <CFormText>
              Leave a blank line between verses. Start the refrain with "R:". {verses.length} stanza
              {verses.length === 1 ? "" : "s"}.
            </CFormText>
          </div>
          <div className="col-12">
            <CFormCheck
              id="pub"
              label="Published"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
            />
          </div>
        </div>
        <CButton
          type="submit"
          color="primary"
          className="mt-3"
          disabled={save.isPending || !verses.length || parsedNums.bad.length > 0}
        >
          {save.isPending ? "Saving…" : hymn ? "Save changes" : "Create hymn"}
        </CButton>
      </CForm>
    </div>
  );
}

function Tunes({ hymn }: { hymn: AdminHymn }) {
  const add = useAddTune(hymn.slug);
  const [name, setName] = useState("");
  return (
    <div className="card panel mb-4">
      <div className="panel-head">
        <h2 className="panel-title">Tunes</h2>
      </div>
      {hymn.tunes.map((t) => (
        <Tune key={t.id} slug={hymn.slug} tune={t} canDelete={hymn.tunes.length > 1} />
      ))}
      <CForm
        className="d-flex gap-2 mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) add.mutate({ name: name.trim() }, { onSuccess: () => setName("") });
        }}
      >
        <CFormInput
          placeholder="Add another tune, e.g. MUELLER"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <CButton type="submit" color="primary" variant="outline" disabled={add.isPending}>
          Add tune
        </CButton>
      </CForm>
      {add.error ? (
        <CAlert color="danger" className="mt-2">
          {errText(add.error)}
        </CAlert>
      ) : null}
    </div>
  );
}

const KIND_LABEL: Record<MediaKind, string> = {
  AUDIO: "Recording",
  MIDI: "MIDI",
  STAFF_PDF: "Staff notation (PDF)",
  SOLFA_PDF: "Sol-fa notation (PDF)",
  YOUTUBE: "YouTube link",
};

function Tune({
  slug,
  tune,
  canDelete,
}: {
  slug: string;
  tune: AdminHymn["tunes"][number];
  canDelete: boolean;
}) {
  const update = useUpdateTune(slug);
  const remove = useRemoveTune(slug);
  const media = useUpdateMedia(slug);
  const delMedia = useRemoveMedia(slug);
  const [name, setName] = useState(tune.name);
  const [composer, setComposer] = useState(tune.composer ?? "");
  const [meter, setMeter] = useState(tune.meter ?? "");
  const err = update.error ?? remove.error ?? media.error ?? delMedia.error;

  return (
    <div className="border rounded p-3 mb-3">
      <div className="row g-2 align-items-end">
        <div className="col-md-4">
          <CFormLabel>Tune</CFormLabel>
          <CFormInput value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="col-md-4">
          <CFormLabel>Composer</CFormLabel>
          <CFormInput value={composer} onChange={(e) => setComposer(e.target.value)} />
        </div>
        <div className="col-md-2">
          <CFormLabel>Metre</CFormLabel>
          <CFormInput value={meter} onChange={(e) => setMeter(e.target.value)} />
        </div>
        <div className="col-md-2 d-flex gap-2">
          <CButton
            color="primary"
            size="sm"
            onClick={() =>
              update.mutate({
                id: tune.id,
                body: {
                  name,
                  composer: composer || null,
                  meter: meter || null,
                  isDefault: tune.isDefault,
                },
              })
            }
          >
            Save
          </CButton>
          {canDelete ? (
            <CButton
              color="danger"
              variant="ghost"
              size="sm"
              onClick={() =>
                confirm(`Delete the tune ${tune.name} and its files?`) && remove.mutate(tune.id)
              }
            >
              Delete
            </CButton>
          ) : null}
        </div>
      </div>
      <div className="mt-2">
        {tune.isDefault ? (
          <span className="state state-ACTIVE">Default tune</span>
        ) : (
          <CButton
            size="sm"
            color="secondary"
            variant="ghost"
            onClick={() =>
              update.mutate({
                id: tune.id,
                body: {
                  name: tune.name,
                  composer: tune.composer,
                  meter: tune.meter,
                  isDefault: true,
                },
              })
            }
          >
            Make default
          </CButton>
        )}
      </div>
      {err ? (
        <CAlert color="danger" className="mt-2">
          {errText(err)}
        </CAlert>
      ) : null}

      <table className="cms-table mt-3">
        <tbody>
          {tune.media.map((m) => (
            <tr key={m.id}>
              <td>
                <b>{m.label}</b>
                <div className="small text-body-secondary">
                  {KIND_LABEL[m.kind]}
                  {m.url ? (
                    <>
                      {" · "}
                      <a href={m.url} target="_blank" rel="noreferrer">
                        open
                      </a>
                    </>
                  ) : null}
                  {m.youtubeId ? ` · youtu.be/${m.youtubeId}` : ""}
                </div>
              </td>
              <td style={{ width: 160 }}>
                <CFormSelect
                  size="sm"
                  aria-label="Access"
                  value={m.access}
                  onChange={(e) =>
                    media.mutate({
                      id: m.id,
                      body: { access: e.target.value as "FREE" | "SUBSCRIBER" },
                    })
                  }
                >
                  <option value="FREE">Free</option>
                  <option value="SUBSCRIBER">Subscribers</option>
                </CFormSelect>
              </td>
              <td style={{ width: 150 }}>
                {m.kind === "AUDIO" ? (
                  m.isDefault ? (
                    <span className="state state-ACTIVE">Default</span>
                  ) : (
                    <CButton
                      size="sm"
                      color="secondary"
                      variant="ghost"
                      onClick={() => media.mutate({ id: m.id, body: { isDefault: true } })}
                    >
                      Make default
                    </CButton>
                  )
                ) : null}
              </td>
              <td style={{ width: 80 }}>
                <CButton
                  size="sm"
                  color="danger"
                  variant="ghost"
                  onClick={() => confirm(`Remove ${m.label}?`) && delMedia.mutate(m.id)}
                >
                  Remove
                </CButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <AddMedia
        slug={slug}
        tuneId={tune.id}
        hasDefaultAudio={tune.media.some((m) => m.kind === "AUDIO" && m.isDefault)}
      />
    </div>
  );
}

function AddMedia({
  slug,
  tuneId,
  hasDefaultAudio,
}: {
  slug: string;
  tuneId: string;
  hasDefaultAudio: boolean;
}) {
  const upload = useUploadMedia(slug);
  const link = useAddLink(slug);
  const [kind, setKind] = useState<MediaKind>("AUDIO");
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const isDefault = kind === "AUDIO" && !hasDefaultAudio;
  const access = defaultMediaAccess(kind, isDefault);
  const busy = upload.isPending || link.isPending;
  const err = upload.error ?? link.error;
  const reset = () => {
    setLabel("");
    setFile(null);
    setUrl("");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const l = label.trim() || KIND_LABEL[kind];
    if (kind === "YOUTUBE")
      link.mutate({ tuneId, body: { kind, url, label: l } }, { onSuccess: reset });
    else if (file) upload.mutate({ tuneId, kind, file, label: l, isDefault }, { onSuccess: reset });
  };

  return (
    <CForm onSubmit={submit} className="row g-2 align-items-end mt-2">
      <div className="col-md-3">
        <CFormLabel>Add</CFormLabel>
        <CFormSelect value={kind} onChange={(e) => setKind(e.target.value as MediaKind)}>
          {(Object.keys(KIND_LABEL) as MediaKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </CFormSelect>
      </div>
      <div className="col-md-3">
        <CFormLabel>Label</CFormLabel>
        <CFormInput
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={kind === "AUDIO" ? "Piano, Choir, Voice…" : KIND_LABEL[kind]}
        />
      </div>
      <div className="col-md-4">
        {kind === "YOUTUBE" ? (
          <>
            <CFormLabel>YouTube or YouTube Music link</CFormLabel>
            <CFormInput
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://music.youtube.com/watch?v=…"
            />
          </>
        ) : (
          <>
            <CFormLabel>File</CFormLabel>
            <CFormInput
              type="file"
              accept={
                kind === "AUDIO"
                  ? "audio/*"
                  : kind === "MIDI"
                    ? ".mid,.midi,audio/midi"
                    : "application/pdf"
              }
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </>
        )}
      </div>
      <div className="col-md-2">
        <CButton
          type="submit"
          color="primary"
          disabled={busy || (kind === "YOUTUBE" ? !url.trim() : !file)}
        >
          {busy ? "Adding…" : "Add"}
        </CButton>
      </div>
      <div className="col-12">
        <CFormText>
          {isDefault ? "This will be the default (free) recording. " : ""}Starts as{" "}
          {access === "FREE" ? "free" : "subscribers only"}; you can change it after.
        </CFormText>
        {err ? (
          <CAlert color="danger" className="mt-2">
            {errText(err)}
          </CAlert>
        ) : null}
      </div>
    </CForm>
  );
}

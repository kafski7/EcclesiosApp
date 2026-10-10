import {
  CAlert,
  CBadge,
  CButton,
  CForm,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormText,
  CFormTextarea,
} from "@coreui/react";
import type { BookCategory, StudioBook } from "@ecclesios/shared";
import { canEditBookContent } from "@ecclesios/shared/domain";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiClientError } from "@/lib/api";
import {
  BOOK_CATEGORIES,
  BOOK_CATEGORY_LABEL,
  formatPrice,
  parsePrice,
  STATUS_COLOR,
  useBookStep,
  useDeleteBook,
  useMyBook,
  useSaveBook,
  useSetPrice,
  useUploadBookPart,
  type BookPart,
} from "@/lib/books";

const errText = (e: unknown) =>
  e instanceof ApiClientError
    ? e.message
    : e instanceof Error
      ? e.message
      : "Something went wrong.";

/** Create / edit a book: details, files, price, submit (D-036). */
export function BookEditPage() {
  const { slug } = useParams();
  const isNew = !slug || slug === "new";
  const q = useMyBook(isNew ? undefined : slug);
  if (!isNew && q.isPending) return <p className="muted">Loading…</p>;
  if (!isNew && q.isError) return <CAlert color="danger">{errText(q.error)}</CAlert>;
  return (
    <>
      <Link to="/platform/books/mine" className="link mb-3 d-inline-block">
        ← My books
      </Link>
      <Editor key={q.data?.slug ?? "new"} book={isNew ? null : q.data!} />
    </>
  );
}

function Editor({ book }: { book: StudioBook | null }) {
  const navigate = useNavigate();
  const save = useSaveBook(book?.slug);
  const step = useBookStep(book?.slug ?? "");
  const setPrice = useSetPrice(book?.slug ?? "");
  const del = useDeleteBook();
  const cur = step.data ?? setPrice.data ?? save.data ?? book;
  const editable = !cur || canEditBookContent(cur.status);
  const [f, setF] = useState({
    title: book?.title ?? "",
    subtitle: book?.subtitle ?? "",
    authorName: book?.authorName ?? "",
    description: book?.description ?? "",
    aboutAuthor: book?.aboutAuthor ?? "",
    category: (book?.category ?? "SPIRITUALITY") as BookCategory,
    language: book?.language ?? "en",
    pages: book?.pages ? String(book.pages) : "",
    isbn: book?.isbn ?? "",
    approbation: book?.approbation ?? "",
    price: book ? (book.priceMinor / 100).toFixed(2) : "0",
    rights: book?.rightsConfirmed ?? false,
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((x) => ({ ...x, [k]: e.target.value }));
  const priceMinor = parsePrice(f.price);
  const priceOk = priceMinor !== null && (priceMinor === 0 || priceMinor >= 100);

  useEffect(() => {
    if (save.data && !book) navigate(`/platform/books/mine/${save.data.slug}`, { replace: true });
  }, [save.data, book, navigate]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!priceOk) return;
    save.mutate({
      title: f.title,
      subtitle: f.subtitle.trim() || null,
      authorName: f.authorName,
      description: f.description,
      aboutAuthor: f.aboutAuthor,
      category: f.category,
      language: f.language,
      pages: f.pages ? Number(f.pages) : null,
      isbn: f.isbn.trim() || null,
      approbation: f.approbation.trim() || null,
      priceMinor: priceMinor!,
      rightsConfirmed: f.rights,
    });
  };
  const err = save.error ?? step.error ?? setPrice.error ?? del.error;

  return (
    <div className="row g-4">
      <div className="col-lg-7">
        <section className="card panel">
          <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
              {book ? "Edit book" : "New book"}
            </h1>
            {cur ? (
              <CBadge color={STATUS_COLOR[cur.status]}>{cur.status.toLowerCase()}</CBadge>
            ) : null}
          </div>
          {cur?.reviewNote && cur.status !== "PUBLISHED" ? (
            <CAlert color="warning">Reviewer: {cur.reviewNote}</CAlert>
          ) : null}
          {cur?.status === "PUBLISHED" ? (
            <CAlert color="info">
              On the shelf. You can change the price and the sample; to change anything else, unlist
              the book (buyers keep reading).
            </CAlert>
          ) : null}
          {cur?.status === "PENDING" ? <CAlert color="info">Waiting for review.</CAlert> : null}
          {err ? <CAlert color="danger">{errText(err)}</CAlert> : null}
          {save.isSuccess && book ? <CAlert color="success">Saved.</CAlert> : null}
          <CForm onSubmit={submit}>
            <fieldset disabled={!editable}>
              <div className="mb-3">
                <CFormLabel htmlFor="bt">Title</CFormLabel>
                <CFormInput
                  id="bt"
                  value={f.title}
                  onChange={set("title")}
                  required
                  maxLength={200}
                />
              </div>
              <div className="mb-3">
                <CFormLabel htmlFor="bs">Subtitle</CFormLabel>
                <CFormInput id="bs" value={f.subtitle} onChange={set("subtitle")} maxLength={200} />
              </div>
              <div className="row g-2 mb-3">
                <div className="col-md-6">
                  <CFormLabel htmlFor="ba">Author (as printed)</CFormLabel>
                  <CFormInput id="ba" value={f.authorName} onChange={set("authorName")} required />
                </div>
                <div className="col-md-6">
                  <CFormLabel htmlFor="bc">Category</CFormLabel>
                  <CFormSelect id="bc" value={f.category} onChange={set("category")}>
                    {BOOK_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {BOOK_CATEGORY_LABEL[c]}
                      </option>
                    ))}
                  </CFormSelect>
                </div>
              </div>
              <div className="mb-3">
                <CFormLabel htmlFor="bd">Description</CFormLabel>
                <CFormTextarea
                  id="bd"
                  rows={6}
                  value={f.description}
                  onChange={set("description")}
                />
              </div>
              <div className="mb-3">
                <CFormLabel htmlFor="bab">About the author</CFormLabel>
                <CFormTextarea
                  id="bab"
                  rows={3}
                  value={f.aboutAuthor}
                  onChange={set("aboutAuthor")}
                />
              </div>
              <div className="row g-2 mb-3">
                <div className="col-md-3">
                  <CFormLabel htmlFor="bl">Language</CFormLabel>
                  <CFormInput id="bl" value={f.language} onChange={set("language")} />
                </div>
                <div className="col-md-3">
                  <CFormLabel htmlFor="bp">Pages</CFormLabel>
                  <CFormInput
                    id="bp"
                    type="number"
                    min={1}
                    value={f.pages}
                    onChange={set("pages")}
                  />
                </div>
                <div className="col-md-6">
                  <CFormLabel htmlFor="bi">ISBN</CFormLabel>
                  <CFormInput id="bi" value={f.isbn} onChange={set("isbn")} />
                </div>
              </div>
              <div className="mb-3">
                <CFormLabel htmlFor="bap">Church approval (optional)</CFormLabel>
                <CFormInput
                  id="bap"
                  value={f.approbation}
                  onChange={set("approbation")}
                  placeholder="Nihil obstat: … · Imprimatur: …"
                />
              </div>
              {!book || editable ? (
                <div className="mb-3">
                  <CFormLabel htmlFor="bpr">Price (GH₵, 0 for free)</CFormLabel>
                  <CFormInput
                    id="bpr"
                    value={f.price}
                    onChange={set("price")}
                    invalid={!priceOk}
                    style={{ maxWidth: 160 }}
                  />
                  {!priceOk ? (
                    <CFormText className="text-danger">Free (0) or at least 1.00.</CFormText>
                  ) : null}
                </div>
              ) : null}
              <CFormCheck
                id="br"
                label="I confirm I hold the rights to publish and sell this book on Ecclesios."
                checked={f.rights}
                onChange={(e) => setF((x) => ({ ...x, rights: e.target.checked }))}
              />
            </fieldset>
            {editable ? (
              <CButton
                type="submit"
                color="primary"
                className="mt-3"
                disabled={save.isPending || !priceOk}
              >
                {save.isPending ? "Saving…" : book ? "Save" : "Create draft"}
              </CButton>
            ) : null}
          </CForm>
          {cur && !editable && cur.status !== "PENDING" ? (
            <PriceBox book={cur} onSave={(p) => setPrice.mutate(p)} pending={setPrice.isPending} />
          ) : null}
        </section>
      </div>

      <div className="col-lg-5">
        {cur ? (
          <>
            <Files book={cur} editable={editable} />
            <section className="card panel mt-4">
              <h2 className="panel-title mb-2">Publishing</h2>
              {cur.problems.length && editable ? (
                <ul className="small text-danger mb-2">
                  {cur.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : null}
              <div className="d-flex gap-2 flex-wrap">
                {cur.status === "DRAFT" ||
                cur.status === "REJECTED" ||
                cur.status === "UNLISTED" ? (
                  <CButton
                    color="primary"
                    disabled={step.isPending || cur.problems.length > 0}
                    onClick={() => step.mutate("submit")}
                  >
                    Submit for review
                  </CButton>
                ) : null}
                {cur.status === "PUBLISHED" ? (
                  <CButton
                    color="secondary"
                    variant="outline"
                    disabled={step.isPending}
                    onClick={() =>
                      confirm("Take this book off the shelf? Buyers keep reading it.") &&
                      step.mutate("unlist")
                    }
                  >
                    Unlist
                  </CButton>
                ) : null}
                {cur.sold === 0 ? (
                  <CButton
                    color="danger"
                    variant="ghost"
                    onClick={() =>
                      confirm(`Delete "${cur.title}"?`) &&
                      del.mutate(cur.slug, { onSuccess: () => navigate("/platform/books/mine") })
                    }
                  >
                    Delete
                  </CButton>
                ) : null}
              </div>
              <p className="small muted mt-3 mb-0">
                Sold {cur.sold} · you earned {formatPrice(cur.earnedMinor)}
              </p>
            </section>
          </>
        ) : (
          <section className="card panel muted">
            Save the draft first, then upload the book and its cover.
          </section>
        )}
      </div>
    </div>
  );
}

function PriceBox({
  book,
  onSave,
  pending,
}: {
  book: StudioBook;
  onSave: (p: number) => void;
  pending: boolean;
}) {
  const [price, setPrice] = useState((book.priceMinor / 100).toFixed(2));
  const p = parsePrice(price);
  const ok = p !== null && (p === 0 || p >= 100);
  return (
    <div className="d-flex gap-2 align-items-end mt-4">
      <div>
        <CFormLabel htmlFor="pp">Price (GH₵)</CFormLabel>
        <CFormInput
          id="pp"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          invalid={!ok}
          style={{ maxWidth: 160 }}
        />
      </div>
      <CButton
        color="primary"
        variant="outline"
        disabled={!ok || pending || p === book.priceMinor}
        onClick={() => onSave(p!)}
      >
        Change price
      </CButton>
    </div>
  );
}

const PARTS: { part: BookPart; label: string; accept: string; help: string }[] = [
  {
    part: "file",
    label: "Book file",
    accept: ".epub,.pdf,application/epub+zip,application/pdf",
    help: "EPUB (best on phones) or PDF, up to 100 MB.",
  },
  {
    part: "cover",
    label: "Cover",
    accept: "image/jpeg,image/png,image/webp",
    help: "Portrait image, 2:3, up to 5 MB.",
  },
  {
    part: "preview",
    label: "Free sample (optional)",
    accept: ".epub,.pdf,application/epub+zip,application/pdf",
    help: "A separate file with the first chapter or so.",
  },
];

function Files({ book, editable }: { book: StudioBook; editable: boolean }) {
  const up = useUploadBookPart(book.slug);
  const has = { file: book.hasFile, cover: Boolean(book.coverUrl), preview: book.hasPreview };
  return (
    <section className="card panel">
      <h2 className="panel-title mb-2">Files</h2>
      {book.coverUrl ? (
        <img src={book.coverUrl} alt="" style={{ width: 120, borderRadius: 8, marginBottom: 12 }} />
      ) : null}
      {PARTS.map(({ part, label, accept, help }) => {
        const locked = part === "file" && !editable;
        return (
          <div key={part} className="mb-3">
            <CFormLabel className="d-flex gap-2 align-items-center">
              {label}{" "}
              {has[part] ? (
                <CBadge color="success">
                  uploaded{part === "file" ? ` · ${book.format}` : ""}
                </CBadge>
              ) : null}
            </CFormLabel>
            <CFormInput
              type="file"
              accept={accept}
              disabled={locked || up.isPending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) up.mutate({ part, file });
                e.target.value = "";
              }}
            />
            <CFormText>{locked ? "Unlist the book to replace its file." : help}</CFormText>
            {has[part] && part !== "file" ? (
              <CButton
                size="sm"
                color="danger"
                variant="ghost"
                onClick={() => up.mutate({ part, file: null })}
              >
                Remove
              </CButton>
            ) : null}
          </div>
        );
      })}
      {up.isPending ? <CFormText>Uploading…</CFormText> : null}
      {up.error ? <CAlert color="danger">{errText(up.error)}</CAlert> : null}
    </section>
  );
}

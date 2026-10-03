import { MentionSuggestionListSchema, type MentionSuggestion } from "@ecclesios/shared";
import { containsLink, encodeMentions, mentionQueryAt, MAX_MENTIONS } from "@ecclesios/shared/domain";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { api } from "@/lib/query";

/**
 * Comment box with @mentions (D-035): typing "@" suggests people from this conversation or the
 * writer's church; picking one inserts "@Full Name". On send, picked names become mention tokens.
 * Links are refused here and by the server.
 */
export function CommentComposer({
  postId,
  maxLength,
  pending,
  error,
  onSend,
}: {
  postId: string;
  maxLength: number;
  pending: boolean;
  error: string | null;
  onSend: (body: string, done: () => void) => void;
}) {
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<MentionSuggestion[]>([]);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [debounced, setDebounced] = useState("");
  const [active, setActive] = useState(0);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(mention?.query ?? ""), 150);
    return () => clearTimeout(t);
  }, [mention?.query]);
  const sugg = useQuery({
    queryKey: ["explore", "mentions", postId, debounced],
    queryFn: () => api.get(`/explore/posts/${postId}/mention-suggestions?q=${encodeURIComponent(debounced)}`, MentionSuggestionListSchema),
    enabled: mention !== null,
    staleTime: 30_000,
  });
  const items = mention ? (sugg.data?.items ?? []) : [];
  useEffect(() => setActive(0), [debounced]);

  const hasLink = containsLink(text);
  const used = picked.filter((p) => text.includes(`@${p.name}`));

  const onChange = (v: string, caret: number) => {
    setText(v);
    setMention(mentionQueryAt(v, caret));
  };

  const pick = (s: MentionSuggestion) => {
    if (!mention) return;
    if (used.length >= MAX_MENTIONS && !used.some((u) => u.id === s.id)) return;
    const before = text.slice(0, mention.start);
    const after = text.slice(mention.start + 1 + mention.query.length);
    const insert = `@${s.name} `;
    const next = before + insert + after;
    setText(next);
    setPicked((p) => (p.some((x) => x.id === s.id) ? p : [...p, s]));
    setMention(null);
    requestAnimationFrame(() => {
      const el = area.current;
      if (!el) return;
      el.focus();
      el.selectionStart = el.selectionEnd = before.length + insert.length;
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!items.length) return;
    if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => (a + 1) % items.length));
    else if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => (a - 1 + items.length) % items.length));
    else if (e.key === "Enter" || e.key === "Tab") (e.preventDefault(), pick(items[active]!));
    else if (e.key === "Escape") setMention(null);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || hasLink) return;
    onSend(encodeMentions(text.trim(), used), () => {
      setText("");
      setPicked([]);
    });
  };

  return (
    <form onSubmit={submit} className="mb-4" style={{ position: "relative" }}>
      <textarea
        ref={area}
        className="field-input"
        style={{ minHeight: 80, fontFamily: "inherit" }}
        maxLength={maxLength}
        placeholder="Add a respectful comment — type @ to mention someone"
        aria-label="Your comment"
        aria-autocomplete="list"
        aria-expanded={items.length > 0}
        value={text}
        onChange={(e) => onChange(e.target.value, e.target.selectionStart)}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setMention(null), 150)}
      />
      {items.length ? (
        <div className="mention-pop" role="listbox" aria-label="People to mention">
          {items.map((s, i) => (
            <button key={s.id} type="button" role="option" aria-selected={i === active} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s)}>
              <b className="small">{s.name}</b>
              {s.hint ? <small>{s.hint}</small> : null}
            </button>
          ))}
        </div>
      ) : null}
      {hasLink ? (
        <p className="small mt-1" style={{ color: "var(--danger)" }}>
          Links aren't allowed in comments.
        </p>
      ) : null}
      {error ? (
        <p className="small mt-1" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary btn-sm mt-2" disabled={pending || !text.trim() || hasLink}>
        {pending ? "Posting…" : "Comment"}
      </button>
    </form>
  );
}

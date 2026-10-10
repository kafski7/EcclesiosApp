import {
  CAlert,
  CBadge,
  CButton,
  CForm,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormSwitch,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from "@coreui/react";
import {
  MESSAGE_LIMITS,
  MESSAGE_PLACEHOLDERS,
  SMS_MAX_SEGMENTS,
  smsSegments,
  type AudienceInput,
  type ComposeMessage,
  type HierarchyLevel,
  type MessageChannel,
  type MessagingOptions,
  type RecipientStatus,
} from "@ecclesios/shared";
import { ArrowLeft, Megaphone, Send } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ApiClientError } from "@/lib/api";
import { formatDate, useCurrent } from "@/lib/cms";
import {
  CHANNEL_TEXT,
  FAILURE_TEXT,
  LEVEL_PLURAL,
  RECIPIENT_TEXT,
  STATUS_TEXT,
  useMessage,
  useMessages,
  useMessagingOptions,
  usePreview,
  useRecipients,
  useSendMessage,
} from "@/lib/messages";
import { EMPTY_FILTERS, useRegister } from "@/lib/register";

const errText = (e: unknown) => (e instanceof ApiClientError ? e.message : "Something went wrong.");
const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

type AudienceKind = AudienceInput["kind"];

/** Messages (functionality §4.7, D-051): the log, and Compose. Sending runs on the workers. */
export function MessagesPage() {
  const ctx = useCurrent();
  const [page, setPage] = useState(1);
  const [channel, setChannel] = useState<MessageChannel | null>(null);
  const [params, setParams] = useSearchParams();
  const [compose, setCompose] = useState<AudienceKind | null>(
    params.get("compose") === "birthdays" ? "BIRTHDAYS_TODAY" : null,
  );
  const opts = useMessagingOptions(ctx.group.id);
  const q = useMessages(ctx.group.id, page, channel);
  const nav = useNavigate();
  const sms = opts.data?.channels.find((c) => c.channel === "SMS");

  return (
    <>
      <div className="dash-head">
        <div>
          <h1>Messages</h1>
          <p className="dash-sub">
            SMS, email and in-app messages from {ctx.group.name}
            {opts.data?.broadcastLevels.length ? ", and broadcasts to the churches below it" : ""}.
          </p>
        </div>
        <CButton color="primary" onClick={() => setCompose("CHURCH")} disabled={!opts.data}>
          <Send className="ic" aria-hidden /> New message
        </CButton>
      </div>

      {opts.data ? (
        <div className="d-flex flex-wrap gap-3 align-items-center mb-3 small">
          {opts.data.smsBalance !== null ? (
            <span>
              SMS credit: <b>{opts.data.smsBalance.toLocaleString()}</b>
              {opts.data.smsPayer ? ` (from ${opts.data.smsPayer.name})` : ""}
            </span>
          ) : null}
          {sms && !sms.available ? <span className="text-body-secondary">{sms.reason}</span> : null}
        </div>
      ) : null}

      <div className="d-flex gap-2 mb-3">
        <CFormSelect
          style={{ maxWidth: 200 }}
          aria-label="Channel"
          value={channel ?? ""}
          onChange={(e) => (setChannel((e.target.value || null) as MessageChannel | null), setPage(1))}
        >
          <option value="">All channels</option>
          {(["SMS", "EMAIL", "IN_APP"] as const).map((c) => (
            <option key={c} value={c}>
              {CHANNEL_TEXT[c]}
            </option>
          ))}
        </CFormSelect>
      </div>

      {q.isError ? <CAlert color="danger">{errText(q.error)}</CAlert> : null}
      <div className="card panel">
        {q.data && !q.data.items.length ? (
          <p className="muted mb-0">No messages yet.</p>
        ) : (
          <CTable hover responsive className="cms-table mb-0">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Sent</CTableHeaderCell>
                <CTableHeaderCell>Message</CTableHeaderCell>
                <CTableHeaderCell>To</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Delivered</CTableHeaderCell>
                <CTableHeaderCell>Status</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {q.data?.items.map((m) => (
                <CTableRow
                  key={m.id}
                  role="link"
                  style={{ cursor: "pointer" }}
                  onClick={() => nav(`/admin/messages/${m.id}`)}
                >
                  <CTableDataCell className="small text-nowrap">
                    {when(m.createdAt)}
                    <div className="text-body-secondary">{m.sender?.name ?? "—"}</div>
                  </CTableDataCell>
                  <CTableDataCell>
                    <CBadge color="light" textColor="dark" className="me-2">
                      {CHANNEL_TEXT[m.channel]}
                    </CBadge>
                    {m.isBroadcast ? (
                      <Megaphone className="ic me-1" aria-label="Broadcast" />
                    ) : null}
                    <b>{m.subject ?? ""}</b>
                    <div className="small text-body-secondary text-truncate" style={{ maxWidth: 420 }}>
                      {m.body}
                    </div>
                  </CTableDataCell>
                  <CTableDataCell className="small">{m.audienceLabel}</CTableDataCell>
                  <CTableDataCell className="text-end small">
                    {m.counts.sent}/{m.counts.recipients - m.counts.skipped}
                    {m.channel === "SMS" && m.smsUsed ? (
                      <div className="text-body-secondary">{m.smsUsed} SMS</div>
                    ) : null}
                  </CTableDataCell>
                  <CTableDataCell>
                    <CBadge color={STATUS_TEXT[m.status].color}>{STATUS_TEXT[m.status].label}</CBadge>
                  </CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>
        )}
      </div>
      {q.data && (q.data.hasMore || page > 1) ? (
        <div className="d-flex gap-2 mt-3">
          <CButton size="sm" color="secondary" variant="ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Newer
          </CButton>
          <CButton size="sm" color="secondary" variant="ghost" disabled={!q.data.hasMore} onClick={() => setPage((p) => p + 1)}>
            Older
          </CButton>
        </div>
      ) : null}
      {compose && opts.data ? (
        <ComposeModal
          options={opts.data}
          initialKind={compose}
          onClose={() => (setCompose(null), params.has("compose") && setParams({}, { replace: true }))}
          onSent={(id) => (setCompose(null), nav(`/admin/messages/${id}`))}
        />
      ) : null}
    </>
  );
}

// ------------------------------------------------------------------ compose

function useDebounced<T>(value: T, ms = 500) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function ComposeModal({
  options,
  initialKind,
  onClose,
  onSent,
}: {
  options: MessagingOptions;
  initialKind: AudienceKind;
  onClose: () => void;
  onSent: (id: string) => void;
}) {
  const ctx = useCurrent();
  const firstChannel = options.channels.find((c) => c.available)?.channel ?? "IN_APP";
  const [channel, setChannel] = useState<MessageChannel>(firstChannel);
  const [kind, setKind] = useState<AudienceKind>(initialKind);
  const [withOut, setWithOut] = useState(false);
  const [societyIds, setSocietyIds] = useState<string[]>([]);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [levels, setLevels] = useState<HierarchyLevel[]>(options.broadcastLevels.slice(0, 1));
  const [who, setWho] = useState<"STAFF" | "MEMBERS">("STAFF");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(
    initialKind === "BIRTHDAYS_TODAY" ? "Happy birthday, {firstName}! {church} prays God's blessings on you." : "",
  );
  const send = useSendMessage(ctx.group.id);

  const audience: AudienceInput | null =
    kind === "CHURCH"
      ? { kind, includeOutstations: withOut }
      : kind === "BIRTHDAYS_TODAY"
        ? { kind, includeOutstations: withOut }
        : kind === "SOCIETIES"
          ? societyIds.length
            ? { kind, ids: societyIds }
            : null
          : kind === "PEOPLE"
            ? people.length
              ? { kind, ids: people.map((p) => p.id) }
              : null
            : levels.length
              ? { kind: "BROADCAST", levels, people: who }
              : null;

  const draft: ComposeMessage | null =
    audience && body.trim() && (channel === "SMS" || subject.trim())
      ? { channel, audience, body, subject: channel === "SMS" ? null : subject }
      : null;
  const preview = usePreview(ctx.group.id, useDebounced(draft));
  const p = preview.data;
  const parts = channel === "SMS" ? smsSegments(body) : 0;
  const limit = MESSAGE_LIMITS.body[channel];
  const canSend = !!draft && !!p && !p.blocker && !preview.isFetching && !send.isPending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (draft && canSend) send.mutate(draft, { onSuccess: (m) => onSent(m.id) });
  };
  const insert = (ph: string) => setBody((b) => `${b}${ph}`);

  return (
    <CModal visible onClose={onClose} size="lg" backdrop="static">
      <CForm onSubmit={submit}>
        <CModalHeader>
          <CModalTitle>New message</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CFormLabel>Send as</CFormLabel>
          <div className="d-flex flex-wrap gap-3 mb-3">
            {options.channels.map((c) => (
              <CFormCheck
                key={c.channel}
                type="radio"
                name="channel"
                id={`ch-${c.channel}`}
                label={CHANNEL_TEXT[c.channel]}
                disabled={!c.available}
                title={c.reason ?? undefined}
                checked={channel === c.channel}
                onChange={() => setChannel(c.channel)}
              />
            ))}
          </div>

          <CFormLabel htmlFor="aud">To</CFormLabel>
          <CFormSelect
            id="aud"
            className="mb-2"
            value={kind}
            onChange={(e) => setKind(e.target.value as AudienceKind)}
          >
            <option value="CHURCH">Everyone at {ctx.group.name}</option>
            {options.societies.length ? <option value="SOCIETIES">Societies and committees</option> : null}
            <option value="PEOPLE">Chosen people</option>
            <option value="BIRTHDAYS_TODAY">
              Today&apos;s birthdays ({options.birthdaysToday})
            </option>
            {options.broadcastLevels.length ? (
              <option value="BROADCAST">Broadcast to churches below</option>
            ) : null}
          </CFormSelect>

          {(kind === "CHURCH" || kind === "BIRTHDAYS_TODAY") && options.canIncludeOutstations ? (
            <CFormSwitch
              id="wo"
              className="mb-3"
              label="Include outstations"
              checked={withOut}
              onChange={(e) => setWithOut(e.target.checked)}
            />
          ) : null}

          {kind === "SOCIETIES" ? (
            <div className="mb-3" style={{ maxHeight: 180, overflowY: "auto" }}>
              {options.societies.map((s) => (
                <CFormCheck
                  key={s.id}
                  id={`s-${s.id}`}
                  label={`${s.name}${s.isCommittee ? " (committee)" : ""} · ${s.members}`}
                  checked={societyIds.includes(s.id)}
                  onChange={(e) =>
                    setSocietyIds((ids) =>
                      e.target.checked ? [...ids, s.id] : ids.filter((x) => x !== s.id),
                    )
                  }
                />
              ))}
            </div>
          ) : null}

          {kind === "PEOPLE" ? <PeoplePicker value={people} onChange={setPeople} /> : null}

          {kind === "BROADCAST" ? (
            <div className="mb-3">
              <div className="d-flex flex-wrap gap-3 mb-2">
                {options.broadcastLevels.map((l) => (
                  <CFormCheck
                    key={l}
                    id={`l-${l}`}
                    label={LEVEL_PLURAL[l] ?? l}
                    checked={levels.includes(l)}
                    onChange={(e) =>
                      setLevels((xs) => (e.target.checked ? [...xs, l] : xs.filter((x) => x !== l)))
                    }
                  />
                ))}
              </div>
              <CFormSelect
                aria-label="Who in those churches"
                value={who}
                onChange={(e) => setWho(e.target.value as "STAFF" | "MEMBERS")}
              >
                <option value="STAFF">Their Administrators and Managers</option>
                <option value="MEMBERS">All their members</option>
              </CFormSelect>
            </div>
          ) : null}

          {channel !== "SMS" ? (
            <>
              <CFormLabel htmlFor="subj">Subject</CFormLabel>
              <CFormInput
                id="subj"
                className="mb-3"
                maxLength={MESSAGE_LIMITS.subject}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </>
          ) : null}

          <div className="d-flex justify-content-between align-items-end">
            <CFormLabel htmlFor="body">Message</CFormLabel>
            <span className="small">
              {MESSAGE_PLACEHOLDERS.map((ph) => (
                <CButton key={ph} size="sm" color="secondary" variant="ghost" onClick={() => insert(ph)}>
                  {ph}
                </CButton>
              ))}
            </span>
          </div>
          <CFormTextarea
            id="body"
            rows={channel === "SMS" ? 4 : 7}
            maxLength={limit}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="small text-body-secondary mt-1 d-flex justify-content-between">
            <span>
              {body.length}/{limit} characters
              {channel === "SMS" ? ` · ${parts} SMS part${parts === 1 ? "" : "s"} (max ${SMS_MAX_SEGMENTS})` : ""}
            </span>
            <span>{"{firstName}"} and {"{church}"} are filled in for each person.</span>
          </div>

          {p ? (
            <CAlert color={p.blocker ? "warning" : "light"} className="mt-3 mb-0 small">
              <b>{p.reachable}</b> of {p.recipients} can be reached
              {channel === "SMS" ? (
                <>
                  {" "}
                  · uses up to <b>{p.cost}</b> SMS credit (balance {p.smsBalance ?? 0})
                </>
              ) : null}
              {p.blocker ? <div className="mt-1">{BLOCKERS[p.blocker]}</div> : null}
            </CAlert>
          ) : preview.isError ? (
            <CAlert color="danger" className="mt-3 mb-0 small">
              {errText(preview.error)}
            </CAlert>
          ) : null}
          {send.isError ? (
            <CAlert color="danger" className="mt-3 mb-0">
              {errText(send.error)}
            </CAlert>
          ) : null}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="ghost" onClick={onClose}>
            Cancel
          </CButton>
          <CButton color="primary" type="submit" disabled={!canSend}>
            <Send className="ic" aria-hidden /> Send
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  );
}

const BLOCKERS: Record<string, string> = {
  NO_RECIPIENTS: "Nobody in that audience can be reached this way.",
  SMS_NOT_AVAILABLE: "SMS isn't available for this church.",
  INSUFFICIENT_SMS_BALANCE: "Not enough SMS credit. Top up under Billing or choose fewer people.",
  SMS_TOO_LONG: `An SMS can be at most ${SMS_MAX_SEGMENTS} parts. Shorten the message.`,
};

function PeoplePicker({
  value,
  onChange,
}: {
  value: { id: string; name: string }[];
  onChange: (v: { id: string; name: string }[]) => void;
}) {
  const ctx = useCurrent();
  const [q, setQ] = useState("");
  const term = useDebounced(q, 300);
  const r = useRegister(
    ctx.group.id,
    { ...EMPTY_FILTERS, q: term, outstations: ctx.group.level === "PARISH" },
    1,
  );
  const chosen = new Set(value.map((v) => v.id));
  return (
    <div className="mb-3">
      <div className="d-flex flex-wrap gap-2 mb-2">
        {value.map((v) => (
          <CBadge key={v.id} color="secondary" className="d-inline-flex gap-1 align-items-center">
            {v.name}
            <button
              type="button"
              className="btn-close btn-close-white"
              style={{ fontSize: 8 }}
              aria-label={`Remove ${v.name}`}
              onClick={() => onChange(value.filter((x) => x.id !== v.id))}
            />
          </CBadge>
        ))}
      </div>
      <CFormInput placeholder="Search by name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
      {term.trim().length >= 2 ? (
        <ul className="list-unstyled mb-0 mt-1" style={{ maxHeight: 160, overflowY: "auto" }}>
          {r.data?.items
            .filter((x) => !chosen.has(x.personId))
            .slice(0, 10)
            .map((x) => (
              <li key={x.personId}>
                <CButton
                  size="sm"
                  color="link"
                  onClick={() => onChange([...value, { id: x.personId, name: `${x.firstName} ${x.lastName}` }])}
                >
                  {x.firstName} {x.lastName}
                  <span className="text-body-secondary"> · {x.church.name}</span>
                </CButton>
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ detail / delivery log

export function MessagePage() {
  const ctx = useCurrent();
  const { id } = useParams();
  const [status, setStatus] = useState<RecipientStatus | null>(null);
  const [page, setPage] = useState(1);
  const m = useMessage(ctx.group.id, id);
  const live = m.data?.status === "QUEUED" || m.data?.status === "SENDING";
  const r = useRecipients(ctx.group.id, id!, page, status, live);
  const d = m.data;
  return (
    <>
      <Link to="/admin/messages" className="small d-inline-flex align-items-center gap-1 mb-2">
        <ArrowLeft className="ic" aria-hidden /> Messages
      </Link>
      {m.isError ? <CAlert color="danger">{errText(m.error)}</CAlert> : null}
      {d ? (
        <>
          <div className="dash-head">
            <div>
              <h1>{d.subject ?? `${CHANNEL_TEXT[d.channel]} message`}</h1>
              <p className="dash-sub">
                {CHANNEL_TEXT[d.channel]} · {d.audienceLabel} · {d.sender?.name ?? "—"},{" "}
                {when(d.createdAt)}
              </p>
            </div>
            <CBadge color={STATUS_TEXT[d.status].color} className="fs-6">
              {STATUS_TEXT[d.status].label}
            </CBadge>
          </div>
          {d.failureReason ? (
            <CAlert color="danger">{FAILURE_TEXT[d.failureReason] ?? d.failureReason}</CAlert>
          ) : null}
          <div className="card panel mb-4">
            <p className="mb-3" style={{ whiteSpace: "pre-wrap" }}>
              {d.body}
            </p>
            <div className="d-flex flex-wrap gap-4 small">
              <span>
                <b>{d.counts.recipients}</b> people
              </span>
              <span className="text-success">
                <b>{d.counts.sent}</b> sent
              </span>
              <span className="text-danger">
                <b>{d.counts.failed}</b> failed
              </span>
              <span>
                <b>{d.counts.skipped}</b> skipped
              </span>
              {live ? (
                <span>
                  <b>{d.counts.pending}</b> waiting
                </span>
              ) : null}
              {d.channel === "SMS" ? (
                <span>
                  <b>{d.smsUsed}</b> SMS credit used
                </span>
              ) : null}
              {d.finishedAt ? <span className="text-body-secondary">Finished {formatDate(d.finishedAt)}</span> : null}
            </div>
          </div>

          <div className="d-flex gap-2 mb-3">
            <CFormSelect
              style={{ maxWidth: 200 }}
              aria-label="Delivery"
              value={status ?? ""}
              onChange={(e) => (setStatus((e.target.value || null) as RecipientStatus | null), setPage(1))}
            >
              <option value="">Everyone</option>
              {(["SENT", "FAILED", "SKIPPED", "PENDING"] as const).map((s) => (
                <option key={s} value={s}>
                  {RECIPIENT_TEXT[s].label}
                </option>
              ))}
            </CFormSelect>
          </div>
          <div className="card panel">
            <CTable responsive className="cms-table mb-0">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Person</CTableHeaderCell>
                  <CTableHeaderCell>Church</CTableHeaderCell>
                  <CTableHeaderCell>To</CTableHeaderCell>
                  <CTableHeaderCell>Delivery</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {r.data?.items.map((x) => (
                  <CTableRow key={x.id}>
                    <CTableDataCell>
                      {x.personId ? <Link to={`/admin/members/${x.personId}`}>{x.name}</Link> : x.name}
                    </CTableDataCell>
                    <CTableDataCell className="small">{x.church ?? "—"}</CTableDataCell>
                    <CTableDataCell className="small">{x.destination ?? "In the app"}</CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={RECIPIENT_TEXT[x.status].color} textColor={x.status === "SKIPPED" ? "dark" : undefined}>
                        {RECIPIENT_TEXT[x.status].label}
                      </CBadge>
                      {x.error ? <div className="small text-body-secondary">{x.error}</div> : null}
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </div>
          {r.data && (r.data.hasMore || page > 1) ? (
            <div className="d-flex gap-2 mt-3">
              <CButton size="sm" color="secondary" variant="ghost" disabled={page === 1} onClick={() => setPage((n) => n - 1)}>
                Previous
              </CButton>
              <CButton size="sm" color="secondary" variant="ghost" disabled={!r.data.hasMore} onClick={() => setPage((n) => n + 1)}>
                Next
              </CButton>
            </div>
          ) : null}
        </>
      ) : (
        <p className="muted">Loading…</p>
      )}
    </>
  );
}

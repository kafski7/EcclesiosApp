import {
  CAlert,
  CButton,
  CForm,
  CFormLabel,
  CFormSelect,
  CFormSwitch,
  CFormText,
} from "@coreui/react";
import type { ChurchSettings } from "@ecclesios/shared";
import { useState, type FormEvent } from "react";
import { useChurchSettings, useSaveChurchSettings } from "@/lib/account";
import { ApiClientError } from "@/lib/api";
import { useCurrent } from "@/lib/cms";

/** Church settings (functionality §4.10, D-039). Administrators change them; Managers can look. */
export function SettingsPage() {
  const ctx = useCurrent();
  const q = useChurchSettings(ctx.group.id);
  return (
    <>
      <div className="dash-head">
        <div>
          <h1>Settings</h1>
          <p className="dash-sub">{ctx.group.name}</p>
        </div>
      </div>
      {q.isError ? (
        <CAlert color="danger">
          {q.error instanceof ApiClientError ? q.error.message : "Settings could not be loaded."}
        </CAlert>
      ) : null}
      {q.data ? <Form key={JSON.stringify(q.data)} s={q.data} /> : null}
    </>
  );
}

function Form({ s }: { s: ChurchSettings }) {
  const ctx = useCurrent();
  const save = useSaveChurchSettings(ctx.group.id);
  const [themeCode, setTheme] = useState(s.themeCode ?? "");
  const [languageCode, setLanguage] = useState(s.languageCode ?? "");
  const [currencyCode, setCurrency] = useState(s.currencyCode ?? "");
  const [manual, setManual] = useState(s.allowManualTransactionDates);
  const [vis, setVis] = useState(s.metropolitanVisibility ?? "aggregates");
  const ro = !s.canEdit;
  const swatch = s.options.themes.find((t) => t.code === themeCode)?.primary;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate({
      themeCode: themeCode || null,
      languageCode: languageCode || null,
      currencyCode: currencyCode || null,
      allowManualTransactionDates: manual,
      ...(s.metropolitanVisibility ? { metropolitanVisibility: vis } : {}),
    });
  };

  return (
    <CForm onSubmit={submit} className="card panel" style={{ maxWidth: 640 }}>
      {ro ? (
        <CAlert color="secondary">
          Only this church's Administrators can change these settings.
        </CAlert>
      ) : null}
      {save.error ? (
        <CAlert color="danger">
          {save.error instanceof ApiClientError ? save.error.message : "Could not save."}
        </CAlert>
      ) : null}
      {save.isSuccess ? <CAlert color="success">Saved.</CAlert> : null}
      <CFormLabel htmlFor="st">Theme</CFormLabel>
      <CFormSelect
        id="st"
        value={themeCode}
        disabled={ro}
        onChange={(e) => setTheme(e.target.value)}
      >
        <option value="">Ecclesios default</option>
        {s.options.themes.map((t) => (
          <option key={t.code} value={t.code}>
            {t.name}
          </option>
        ))}
      </CFormSelect>
      <CFormText className="mb-3 d-block">
        {swatch ? <span className="theme-swatch" style={{ background: swatch }} /> : null}
        Colours used for your church's page and the app when members open it.
      </CFormText>
      <CFormLabel htmlFor="sl">Language</CFormLabel>
      <CFormSelect
        id="sl"
        value={languageCode}
        disabled={ro}
        onChange={(e) => setLanguage(e.target.value)}
        className="mb-3"
      >
        <option value="">Not set</option>
        {s.options.languages.map((l) => (
          <option key={l.code} value={l.code}>
            {l.name}
          </option>
        ))}
      </CFormSelect>
      <CFormLabel htmlFor="sc">Currency</CFormLabel>
      <CFormSelect
        id="sc"
        value={currencyCode}
        disabled={ro}
        onChange={(e) => setCurrency(e.target.value)}
        className="mb-3"
      >
        <option value="">Not set</option>
        {s.options.currencies.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name} ({c.symbol})
          </option>
        ))}
      </CFormSelect>
      <CFormSwitch
        id="sm"
        label="Allow back-dated entries for collections"
        checked={manual}
        disabled={ro}
        onChange={(e) => setManual(e.target.checked)}
      />
      <CFormText className="mb-3 d-block">
        When on, outstation staff can date a collection up to 90 days back instead of today.
      </CFormText>
      {s.metropolitanVisibility ? (
        <>
          <CFormLabel htmlFor="mv">What the metropolitan archdiocese sees</CFormLabel>
          <CFormSelect
            id="mv"
            value={vis}
            disabled={ro}
            onChange={(e) => setVis(e.target.value as typeof vis)}
          >
            <option value="hidden">Nothing</option>
            <option value="aggregates">Totals only (recommended)</option>
            <option value="detailed">Summaries down to each parish</option>
          </CFormSelect>
          <CFormText className="mb-3 d-block">
            The archdiocese never changes anything in this diocese. The province's national totals
            are not affected.
          </CFormText>
        </>
      ) : null}
      {!ro ? (
        <CButton
          type="submit"
          color="primary"
          disabled={save.isPending}
          style={{ alignSelf: "flex-start" }}
        >
          {save.isPending ? "Saving…" : "Save settings"}
        </CButton>
      ) : null}
    </CForm>
  );
}

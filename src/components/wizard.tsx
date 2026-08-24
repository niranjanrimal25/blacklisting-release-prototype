"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  FileSearch,
  Landmark,
  Loader2,
  PenLine,
  ScanSearch,
  ShieldCheck,
  Snowflake,
  UsersRound,
  Database,
  CircleAlert,
} from "lucide-react";
import { createCaseAction, lookupAction } from "@/app/actions";
import {
  RELEASE_TYPES,
  RELEASE_TYPE_LIST,
  type FieldDef,
  type ReleaseTypeKey,
} from "@/lib/workflow";
import type { blacklistRecords } from "@/db/schema";

type RecordRow = typeof blacklistRecords.$inferSelect;
type Reviewer = { id: string; name: string; role: string; unit: string; title: string };

const STEPS = ["Identify case", "Release type", "Details & routing", "Confirm"];

function prefill(record: RecordRow | null, type: ReleaseTypeKey): Record<string, string> {
  const out: Record<string, string> = {};
  if (!record) return out;
  const ch = record.chequeDetails ?? {};
  const np = record.npaDetails ?? {};
  if (type === "applicant_cheque" || type === "ac_holder_cheque" || type === "court") {
    if (ch.chequeNumber) out.chequeNumber = ch.chequeNumber;
    if (ch.amount) out.chequeAmount = ch.amount;
    if (ch.date) out.chequeDate = ch.date;
    if (ch.payee) { out.payeeName = ch.payee; }
    if (ch.bank) out.issuingBranch = ch.bank;
  }
  if (type === "npa" || type === "temporary" || type === "partial") {
    if (np.loanAccount) out.loanAccountNo = np.loanAccount;
    if (np.outstanding) out.outstandingAmount = np.outstanding;
    if (np.emi) out.emiAmount = np.emi;
  }
  if (type === "partial") {
    out.borrowerName = record.partyName;
    const g = (record.parties ?? []).find((p) => p.role === "guarantor");
    if (g) out.guarantorName = g.name;
    else if (np.guarantor) out.guarantorName = np.guarantor;
  }
  return out;
}

export function NewCaseWizard({ reviewers, prefetchedRecord }: { reviewers: Reviewer[]; prefetchedRecord: RecordRow | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [identifier, setIdentifier] = useState(prefetchedRecord?.caseNumber ?? prefetchedRecord?.blacklistNumber ?? "");
  const [record, setRecord] = useState<RecordRow | null>(prefetchedRecord ?? null);
  const [lookedUp, setLookedUp] = useState(!!prefetchedRecord);
  const [searching, setSearching] = useState(false);

  const [manualMode, setManualMode] = useState(false);
  const [manual, setManual] = useState({
    partyName: "", partyType: "individual", cifId: "", blacklistNumber: "",
    accountNumber: "", category: "cheque", reason: "", freezeCode: "002",
  });

  const [typeKey, setTypeKey] = useState<ReleaseTypeKey | null>(null);
  const [fieldVals, setFieldVals] = useState<Record<string, string>>({});
  const [routeMode, setRouteMode] = useState<"pool" | "user">("pool");
  const [reviewerId, setReviewerId] = useState("");

  const def = typeKey ? RELEASE_TYPES[typeKey] : null;
  const identified = !!record || manualMode;

  function doLookup() {
    setError(null);
    setSearching(true);
    setTimeout(async () => {
      const res = await lookupAction(identifier);
      setSearching(false);
      setLookedUp(true);
      if (res.found) {
        setRecord(res.record as RecordRow);
        setManualMode(false);
      } else {
        setRecord(null);
      }
    }, 250);
  }

  function chooseType(k: ReleaseTypeKey) {
    setTypeKey(k);
    setFieldVals(prefill(record, k));
    const t = RELEASE_TYPES[k];
    if (!t.poolEligible) setRouteMode("user");
    else setRouteMode("pool");
  }

  function setField(key: string, v: string) {
    setFieldVals((s) => ({ ...s, [key]: v }));
  }

  function validateStep3(): string | null {
    if (!def) return "Select a release type first.";
    for (const f of def.fields) {
      if (f.kind === "static") continue;
      const v = (fieldVals[f.key] ?? "").trim();
      if (f.required && (!v || (f.kind === "checkbox" && v !== "yes"))) return `“${f.label}” is required.`;
    }
    if (!def.poolEligible || routeMode === "user") {
      if (!reviewerId) return "Select the reviewing authority according to the reporting structure.";
    }
    return null;
  }

  function next() {
    setError(null);
    if (step === 0 && !identified) return setError("Retrieve a DigiHost case or switch to manual entry to proceed.");
    if (step === 0 && manualMode) {
      if (!manual.partyName.trim() || !manual.cifId.trim() || !manual.blacklistNumber.trim())
        return setError("Manual entry requires party name, CIF ID and Blacklist Number.");
    }
    if (step === 1 && !typeKey) return setError("Select one of the six release types.");
    if (step === 2) {
      const v = validateStep3();
      if (v) return setError(v);
    }
    setStep((s) => Math.min(s + 1, 3));
  }

  function create() {
    setError(null);
    start(async () => {
      const res = await createCaseAction({
        recordId: record?.id,
        manual: record ? undefined : manual,
        releaseType: typeKey!,
        routedToPool: def!.poolEligible && routeMode === "pool",
        reviewerId: routeMode === "user" || !def!.poolEligible ? reviewerId : null,
        data: fieldVals,
      });
      if (!res.ok) setError(res.error ?? "Could not create the case.");
      else router.push(`/cases/${res.caseId}?created=1`);
    });
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[240px_1fr]">
      {/* Step rail */}
      <ol className="space-y-1">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li key={s}>
              <button
                onClick={() => i < step && setStep(i)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${active ? "border border-line bg-card" : done ? "hover:bg-paper2/60" : "opacity-60"}`}
              >
                <span className={`flex size-7 items-center justify-center rounded-full border font-mono text-[11px] ${active ? "border-pine bg-pine text-white" : done ? "border-pine/40 bg-white text-pine" : "border-line bg-white text-ink3"}`}>
                  {done ? "✓" : String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  <span className={`block text-[13px] font-medium ${active || done ? "text-ink" : "text-ink3"}`}>{s}</span>
                  <span className="block text-[10px] uppercase tracking-wider text-ink3">
                    {i === 0 ? (record ? "Auto-populated" : manualMode ? "Manual entry" : "DigiHost / manual") : i === 1 ? (def ? def.short : "Six types") : i === 2 ? "Type-specific fields" : "Draft & checklist"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Content */}
      <div className="rounded-xl border border-line bg-card p-6 lg:p-8">
        {error && (
          <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
            <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
          </div>
        )}

        {/* ---------------- STEP 0: identify ---------------- */}
        {step === 0 && (
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">Identify the blacklisted case</h2>
            <p className="mt-1 text-[13px] text-ink2">
              Enter the Case Number, CIF ID or Blacklist Number. For DigiHost cases the Case Number is the primary
              retrieval key — available data and documents are auto-populated.
            </p>

            <div className="mt-6 flex items-center gap-2">
              <div className="relative flex-1 max-w-lg">
                <ScanSearch className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink3" />
                <input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && doLookup()}
                  placeholder="e.g., DH-2025-03417 · CIF-786541 · BLK-2025-01121"
                  className="field-input pl-9 font-mono"
                />
              </div>
              <button
                onClick={doLookup}
                disabled={searching || !identifier.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-[13px] font-medium text-paper hover:bg-pinedeep disabled:opacity-50"
              >
                {searching ? <Loader2 className="size-4 animate-spin" /> : <FileSearch className="size-4" />}
                Retrieve
              </button>
              <button
                onClick={() => { setManualMode(true); setRecord(null); setLookedUp(true); setError(null); }}
                className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-[13px] font-medium transition-colors ${manualMode ? "border-gold bg-goldsoft/40 text-ink" : "border-line bg-white text-ink2 hover:border-ink/40"}`}
              >
                <PenLine className="size-4" /> Manual entry
              </button>
            </div>

            {lookedUp && !record && !manualMode && (
              <div className="mt-6 flex max-w-xl items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3.5 text-[13px] text-amber-900">
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                No DigiHost case matches this identifier. Use the manual-entry fallback to capture the blacklist details
                and upload the relevant documents.
              </div>
            )}

            {record && (
              <div className="mt-6 overflow-hidden rounded-lg border border-pine/25 bg-white">
                <div className="flex items-center justify-between border-b border-line bg-pinedeep px-4 py-2.5">
                  <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-white/85">
                    <Database className="size-3.5" /> Retrieved from DigiHost — verify before proceeding
                  </span>
                  <span className="rounded-full bg-white/15 px-2 py-0.5 font-mono text-[10px] text-white">
                    {record.source === "digihost" ? "auto-populated" : "manual register"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 p-5 md:grid-cols-3">
                  <Ident label="Party" value={record.partyName} strong />
                  <Ident label="Party type" value={record.partyType} />
                  <Ident label="CIF ID" value={record.cifId} mono />
                  <Ident label="Blacklist no." value={record.blacklistNumber} mono />
                  <Ident label="DigiHost case" value={record.caseNumber ?? "—"} mono />
                  <Ident label="Account" value={record.accountNumber ?? "—"} mono />
                  <Ident label="Category" value={record.category === "cheque" ? "Cheque blacklisting" : "NPA blacklisting"} />
                  <Ident label="Freeze code(s)" value={(record.freezeCodes ?? []).join(" + ")} mono />
                  <Ident label="Account" value={record.accountStatus} />
                </div>
                <div className="border-t border-line px-5 py-3 text-[12px] text-ink2">
                  <span className="font-medium text-ink">Reason:</span> {record.reason}
                  {record.documents.length > 0 && (
                    <span className="ml-3 text-pine">· {record.documents.length} prior-process document(s) will carry forward</span>
                  )}
                </div>
              </div>
            )}

            {manualMode && (
              <div className="mt-6 rounded-lg border border-gold/40 bg-goldsoft/20 p-5">
                <div className="mb-4 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-gold">
                  <PenLine className="size-3.5" /> Manual-entry fallback — complete all blacklist details
                </div>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  <label className="block md:col-span-2">
                    <FL>Party name *</FL>
                    <input className="field-input" value={manual.partyName} onChange={(e) => setManual({ ...manual, partyName: e.target.value })} placeholder="Full name of individual or entity" />
                  </label>
                  <label className="block">
                    <FL>Party type</FL>
                    <select className="field-input" value={manual.partyType} onChange={(e) => setManual({ ...manual, partyType: e.target.value })}>
                      <option value="individual">Individual</option>
                      <option value="entity">Entity / Company</option>
                    </select>
                  </label>
                  <label className="block">
                    <FL>CIF ID *</FL>
                    <input className="field-input font-mono" value={manual.cifId} onChange={(e) => setManual({ ...manual, cifId: e.target.value })} placeholder="CIF-…" />
                  </label>
                  <label className="block">
                    <FL>Blacklist Number *</FL>
                    <input className="field-input font-mono" value={manual.blacklistNumber} onChange={(e) => setManual({ ...manual, blacklistNumber: e.target.value })} placeholder="BLK-…" />
                  </label>
                  <label className="block">
                    <FL>Account number</FL>
                    <input className="field-input font-mono" value={manual.accountNumber} onChange={(e) => setManual({ ...manual, accountNumber: e.target.value })} />
                  </label>
                  <label className="block">
                    <FL>Category</FL>
                    <select className="field-input" value={manual.category} onChange={(e) => setManual({ ...manual, category: e.target.value })}>
                      <option value="cheque">Cheque</option>
                      <option value="npa">NPA</option>
                    </select>
                  </label>
                  <label className="block">
                    <FL>Freeze reason code</FL>
                    <select className="field-input font-mono" value={manual.freezeCode} onChange={(e) => setManual({ ...manual, freezeCode: e.target.value })}>
                      <option value="002">002 — Cheque dishonour</option>
                      <option value="025">025 — Regulatory directive</option>
                      <option value="100">100 — Loan default / NPA</option>
                      <option value="101">101 — Signature irregularity</option>
                      <option value="003">003 — Investigation hold</option>
                    </select>
                  </label>
                  <label className="block md:col-span-3">
                    <FL>Blacklisting reason</FL>
                    <input className="field-input" value={manual.reason} onChange={(e) => setManual({ ...manual, reason: e.target.value })} placeholder="Reason recorded in the manual register" />
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------------- STEP 1: release type ---------------- */}
        {step === 1 && (
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">Select the release type</h2>
            <p className="mt-1 text-[13px] text-ink2">
              The system displays the appropriate fields and document checklist for the selected type.
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {RELEASE_TYPE_LIST.map((t) => {
                const active = typeKey === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => chooseType(t.key)}
                    className={`group relative rounded-lg border p-4 text-left transition-all ${active ? "border-pine bg-pine/5 shadow-sm" : "border-line bg-white hover:border-pine/40 hover:shadow-sm"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`rounded px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wider ${active ? "bg-pine text-white" : "bg-paper2 text-ink2"}`}>{t.code}</span>
                      {active && <BadgeCheck className="size-4 text-pine" />}
                    </div>
                    <div className="mt-3 text-[14.5px] font-semibold text-ink">{t.label}</div>
                    <div className="mt-1.5 text-[12px] leading-relaxed text-ink2 line-clamp-3">{t.description}</div>
                    <div className="mt-3 flex items-center gap-2 text-[10.5px] uppercase tracking-wider text-ink3">
                      <span className={`rounded-full border px-2 py-0.5 ${t.category === "cheque" ? "tone-cyan" : t.category === "npa" ? "tone-violet" : "tone-neutral"}`}>{t.category}</span>
                      <span>{t.letterOwner === "cad" ? "Letter on CAD screen" : "Letter on initiator screen"}</span>
                      {t.poolEligible && <span className="text-gold">BROPs pool</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            {def && (
              <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-line bg-paper2/50 px-4 py-3 text-[12.5px] text-ink2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-pine" />
                <span><span className="font-medium text-ink">Outcome:</span> {def.outcomeNote}</span>
              </div>
            )}
          </div>
        )}

        {/* ---------------- STEP 2: details ---------------- */}
        {step === 2 && def && (
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">{def.label} — case details</h2>
            <p className="mt-1 text-[13px] text-ink2">
              Verify auto-populated values and complete the remaining type-specific details. Documents are attached on
              the case page after creation.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              {def.fields.map((f) => (
                <Field key={f.key} f={f} value={fieldVals[f.key] ?? ""} autoFilled={!!prefill(record, def.key)[f.key]} onChange={(v) => setField(f.key, v)} />
              ))}
            </div>

            <div className="mt-8 border-t border-line pt-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink3">Reviewing authority</div>
              <p className="mt-1 text-[12.5px] text-ink2">
                Select according to the reporting structure — e.g., BROPs for a BOC-reporting branch; OI/BM for branch
                or CSD-initiated cases.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {def.poolEligible && (
                  <button
                    onClick={() => setRouteMode("pool")}
                    className={`rounded-lg border p-4 text-left transition-all ${routeMode === "pool" ? "border-gold bg-goldsoft/25" : "border-line bg-white hover:border-ink/30"}`}
                  >
                    <div className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                      <UsersRound className="size-4 text-gold" /> BROPs Pool
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-ink2">
                      Case enters the Branch Operations Control pool; a BROPs user claims it before review.
                    </p>
                  </button>
                )}
                {reviewers.map((r) => {
                  const active = routeMode === "user" && reviewerId === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => { setRouteMode("user"); setReviewerId(r.id); }}
                      className={`rounded-lg border p-4 text-left transition-all ${active ? "border-pine bg-pine/5" : "border-line bg-white hover:border-ink/30"}`}
                    >
                      <div className="text-[13.5px] font-semibold text-ink">{r.name}</div>
                      <p className="mt-0.5 text-[12px] text-ink2">{r.title} · {r.unit}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ---------------- STEP 3: confirm ---------------- */}
        {step === 3 && def && (
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">Confirm and create the case</h2>
            <p className="mt-1 text-[13px] text-ink2">
              The case is created in Draft. You then complete the document checklist and use{" "}
              <span className="font-medium text-ink">Proceed</span> to submit — the maker completeness check runs there.
            </p>

            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <div className="rounded-lg border border-line bg-white p-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink3">Blacklist record</div>
                <div className="mt-2 text-[15px] font-semibold text-ink">{record ? record.partyName : manual.partyName}</div>
                <dl className="mt-3 space-y-1.5 text-[12.5px]">
                  <Row k="Blacklist no." v={record?.blacklistNumber ?? manual.blacklistNumber} mono />
                  <Row k="CIF ID" v={record?.cifId ?? manual.cifId} mono />
                  <Row k="Source" v={record ? (record.source === "digihost" ? "DigiHost — auto-populated" : "Manual register") : "Manual entry"} />
                  <Row k="Freeze code(s)" v={record ? (record.freezeCodes ?? []).join(" + ") : manual.freezeCode} mono />
                </dl>
              </div>
              <div className="rounded-lg border border-line bg-white p-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink3">Release</div>
                <div className="mt-2 text-[15px] font-semibold text-ink">{def.label}</div>
                <dl className="mt-3 space-y-1.5 text-[12.5px]">
                  <Row k="Routing" v={def.poolEligible && routeMode === "pool" ? "BROPs pool (claim before review)" : reviewers.find((r) => r.id === reviewerId)?.name ?? "—"} />
                  <Row k="Letter stage" v={def.letterOwner === "cad" ? "CIB letter on CAD screen" : "Letter to initiator after approval"} />
                  {Object.entries(fieldVals).filter(([, v]) => v && v !== "yes").slice(0, 3).map(([k, v]) => (
                    <Row key={k} k={def.fields.find((f) => f.key === k)?.label ?? k} v={String(v).slice(0, 60)} />
                  ))}
                </dl>
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-line bg-paper2/40 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink3">Mandatory documents (upload next)</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {def.documents.filter((d) => d.required).map((d) => (
                  <span key={d.key} className="rounded-full border border-line bg-white px-2.5 py-1 text-[11px] text-ink2">{d.label}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer nav */}
        <div className="mt-8 flex items-center justify-between border-t border-line pt-5">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || pending}
            className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-4 py-2 text-[13px] font-medium text-ink2 transition-colors hover:border-ink/40 disabled:opacity-40"
          >
            <ArrowLeft className="size-4" /> Back
          </button>
          {step < 3 ? (
            <button
              onClick={next}
              className="inline-flex items-center gap-2 rounded-md bg-ink px-5 py-2 text-[13px] font-medium text-paper transition-colors hover:bg-pinedeep"
            >
              Continue <ArrowRight className="size-4" />
            </button>
          ) : (
            <button
              onClick={create}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-md bg-pine px-5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-pinedeep disabled:opacity-60"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Landmark className="size-4" />}
              Create release case
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FL({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-ink2">{children}</span>;
}

function Ident({ label, value, mono, strong }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink3">{label}</div>
      <div className={`mt-0.5 truncate text-[13px] ${mono ? "font-mono text-[12px]" : ""} ${strong ? "font-semibold text-ink" : "text-ink"}`}>{value}</div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="w-28 shrink-0 text-[11px] uppercase tracking-wider text-ink3">{k}</dt>
      <dd className={`min-w-0 flex-1 truncate text-ink ${mono ? "font-mono text-[11.5px]" : ""}`}>{v || "—"}</dd>
    </div>
  );
}

export function Field({ f, value, onChange, autoFilled }: { f: FieldDef; value: string; onChange: (v: string) => void; autoFilled?: boolean }) {
  if (f.kind === "static") {
    return (
      <div className={`${f.wide ? "md:col-span-2" : ""} flex items-start gap-2.5 rounded-lg border border-pine/25 bg-pine/5 px-4 py-3`}>
        <Snowflake className="mt-0.5 size-4 shrink-0 text-pine" />
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink2">{f.label}</div>
          <div className="mt-0.5 text-[13px] text-ink">{f.autoValue}</div>
        </div>
      </div>
    );
  }
  if (f.kind === "checkbox") {
    return (
      <label className={`${f.wide ? "md:col-span-2" : ""} flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors ${value === "yes" ? "border-pine bg-pine/5" : "border-line bg-white"}`}>
        <input type="checkbox" checked={value === "yes"} onChange={(e) => onChange(e.target.checked ? "yes" : "")} className="mt-1 size-4 accent-[#0f5e4e]" />
        <span className="text-[13px] leading-snug text-ink">{f.label}{f.required && <span className="text-red-600"> *</span>}</span>
      </label>
    );
  }
  return (
    <label className={`block ${f.wide ? "md:col-span-2" : ""}`}>
      <span className="mb-1.5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-ink2">
        {f.label} {f.required && <span className="text-red-600">*</span>}
        {autoFilled && <span className="rounded bg-pine/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-pine">auto</span>}
      </span>
      {f.kind === "textarea" ? (
        <textarea className="field-input min-h-24" value={value} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} />
      ) : f.kind === "select" ? (
        <select className="field-input" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input className="field-input" type={f.kind === "date" ? "date" : f.kind === "number" ? "number" : "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} />
      )}
      {f.hint && <span className="mt-1 block text-[11px] leading-snug text-ink3">{f.hint}</span>}
    </label>
  );
}

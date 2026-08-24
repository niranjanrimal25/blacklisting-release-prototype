import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import {
  ArrowLeft,
  FileSignature,
  Landmark,
  Printer,
  ShieldCheck,
  Snowflake,
  Sparkles,
  CircleCheck,
} from "lucide-react";
import { db } from "@/db";
import { blacklistRecords, caseDocuments, caseEvents, releaseCases, users } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import {
  RELEASE_TYPES,
  STATUS_META,
  availableActions,
  fmtDate,
  fmtMoney,
  missingRequiredDocs,
  roleLabel,
  unfreezeEligibility,
  type ReleaseTypeKey,
  type StatusKey,
} from "@/lib/workflow";
import { Card, MetaItem, PhaseStepper, SectionTitle, StatusPill, UserChip } from "@/components/ui";
import { ActionPanel } from "@/components/case-actions";
import { DocumentsPanel, OtherUpload, SignedLetterUpload, type DocItem, type ReqRow } from "@/components/documents-panel";
import { Timeline, type EventItem } from "@/components/timeline";

export const dynamic = "force-dynamic";

const EDITABLE = ["DRAFT", "ON_HOLD", "RETURNED", "QUERY"];
const AFTER_LETTER = ["PENDING_CAD", "CIB_RETURNED", "CIB_REPORTED", "RELEASED"];

export default async function CasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const { created } = await searchParams;
  const caseId = Number(id);

  const [kase] = await db.select().from(releaseCases).where(eq(releaseCases.id, caseId)).limit(1);
  if (!kase) notFound();

  const def = RELEASE_TYPES[kase.releaseType as ReleaseTypeKey];
  const [record, docs, events, allUsers] = await Promise.all([
    kase.blacklistRecordId
      ? db.select().from(blacklistRecords).where(eq(blacklistRecords.id, kase.blacklistRecordId)).limit(1).then((r) => r[0] ?? null)
      : Promise.resolve(null),
    db.select().from(caseDocuments).where(eq(caseDocuments.caseId, caseId)).orderBy(asc(caseDocuments.createdAt)),
    db.select().from(caseEvents).where(eq(caseEvents.caseId, caseId)).orderBy(asc(caseEvents.createdAt)),
    db.select().from(users),
  ]);

  const initiator = allUsers.find((u) => u.id === kase.initiatorId);
  const reviewer = allUsers.find((u) => u.id === kase.reviewerId);
  const isInitiator = user.id === kase.initiatorId;
  const isReviewer = user.id === kase.reviewerId;

  const statusMeta = STATUS_META[kase.status as StatusKey];
  const letterStageReached = kase.status === "LETTER_PENDING" || AFTER_LETTER.includes(kase.status);
  const signedDoc = docs.find((d) => d.requirementKey === "signed_letter") ?? null;
  const canEditDocs =
    (isInitiator && EDITABLE.includes(kase.status)) ||
    (user.role === "cad" && ["LETTER_PENDING", "PENDING_CAD", "CIB_REPORTED", "CIB_RETURNED"].includes(kase.status));
  const canUploadSigned =
    kase.status === "LETTER_PENDING" &&
    (def.letterOwner === "initiator" ? isInitiator : user.role === "cad");

  const toDocItem = (d: (typeof docs)[number]): DocItem => ({
    id: d.id,
    requirementKey: d.requirementKey,
    label: d.label,
    fileName: d.fileName,
    hasFile: !!d.filePath,
    source: d.source,
    size: d.size,
  });

  const reqRows: ReqRow[] = def.documents.map((r) => ({
    key: r.key,
    label: r.label,
    note: r.note,
    required: r.required,
    docs: docs.filter((d) => d.requirementKey === r.key).map(toDocItem),
  }));
  const otherDocs = docs.filter((d) => d.requirementKey === null && d.source !== "system" && !d.label.startsWith("CAD/CIC") && d.label !== "Returned by CIB — feedback");

  const uploadedKeys = docs.filter((d) => d.requirementKey).map((d) => d.requirementKey as string);
  const missing = missingRequiredDocs(def.key, uploadedKeys);

  const actions = availableActions({
    status: kase.status,
    role: user.role,
    isInitiator,
    isReviewer,
    letterOwner: def.letterOwner,
    routedToPool: kase.routedToPool,
    claimed: !!kase.reviewerId,
  });

  const forwardTargets = allUsers
    .filter((u) => ["reviewer_oi", "reviewer_bm", "brops"].includes(u.role) && u.id !== user.id)
    .map((u) => ({ id: u.id, name: u.name, title: u.title }));

  const holderText = (() => {
    if (["DRAFT", "ON_HOLD", "RETURNED", "QUERY"].includes(kase.status)) return initiator?.name ?? "Initiator";
    if (kase.status === "PENDING_REVIEW") return reviewer ? reviewer.name : kase.routedToPool ? "BROPs pool — unclaimed" : "Reviewer";
    if (kase.status === "LETTER_PENDING") return def.letterOwner === "initiator" ? initiator?.name ?? "Initiator" : "CAD/CIC";
    if (["PENDING_CAD", "CIB_RETURNED", "CIB_REPORTED"].includes(kase.status)) return "CAD/CIC";
    return "Closed";
  })();

  const attachmentFiles: Record<number, { fileName: string }> = {};
  for (const d of docs) if (d.fileName) attachmentFiles[d.id] = { fileName: d.fileName };

  const eventItems: EventItem[] = events.map((e) => ({
    id: e.id,
    action: e.action,
    actorName: e.actorName,
    fromStatus: e.fromStatus,
    toStatus: e.toStatus,
    remarks: e.remarks,
    attachmentDocId: e.attachmentDocId,
    meta: e.meta ?? {},
    createdAt: e.createdAt,
  }));

  const eligibility = record ? unfreezeEligibility(record.freezeCodes ?? []) : null;
  const data = kase.data;
  const detailFields = def.fields.filter((f) => f.kind !== "static");
  const statics = def.fields.filter((f) => f.kind === "static");

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink2 hover:text-pine">
        <ArrowLeft className="size-3.5" /> Back to work queue
      </Link>

      {created === "1" && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-pine/30 bg-pine/5 px-4 py-3.5">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-pine" />
          <div className="text-[13px] text-pinedeep">
            <span className="font-semibold">Case created in Draft.</span> Complete the type-specific document checklist
            below, then use <span className="font-semibold">Proceed — Submit to Reviewer</span>. The maker completeness
            check runs on all mandatory documents{" "}
            {missing.length > 0 && <span className="font-semibold">({missing.length} still missing)</span>}.
          </div>
        </div>
      )}

      {/* Header */}
      <Card className="mt-4 overflow-hidden">
        <div className="border-b border-line bg-pinedeep px-6 py-5 text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[13px] tracking-wider text-goldsoft">{kase.reference}</span>
                <StatusPill status={kase.status} size="sm" />
                {kase.status === "PENDING_REVIEW" && kase.routedToPool && !kase.reviewerId && (
                  <span className="rounded-full bg-gold px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wider text-side">In BROPs pool</span>
                )}
              </div>
              <h1 className="mt-2 font-display text-[26px] font-semibold leading-tight tracking-tight">
                {data.partyName}
              </h1>
              <div className="mt-1 text-[12px] text-white/60">
                {def.label} · {data.partyType === "entity" ? "Entity / Company" : "Individual"} · initiated {fmtDate(kase.createdAt)}
                {initiator && <> by {initiator.name}</>}
              </div>
            </div>
            <div className="text-right text-[11.5px] leading-relaxed text-white/60">
              <div className="font-mono">{data.blacklistNumber}</div>
              {data.caseNumber && <div className="font-mono">{data.caseNumber}</div>}
              <div>Currently with: <span className="font-medium text-white/90">{holderText}</span></div>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto px-6 py-4">
          <PhaseStepper status={kase.status} />
        </div>
      </Card>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        {/* ------------- main column ------------- */}
        <div className="space-y-6">
          {/* Case data */}
          <Card>
            <div className="px-5 pt-5">
              <SectionTitle index="01" title="Case data" sub={`${statusMeta.label} · ${def.short} · captured at initiation and verified at every stage.`} />
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line px-5 py-5 md:grid-cols-4">
              <MetaItem label="Source" value={data.source === "digihost" ? "DigiHost — auto-populated" : "Manual entry"} />
              <MetaItem label="Blacklist no." value={data.blacklistNumber} mono />
              <MetaItem label="CIF ID" value={data.cifId} mono />
              <MetaItem label="Account" value={data.accountNumber || "—"} mono />
              {detailFields.filter((f) => data[f.key] && f.key !== "basis").map((f) => (
                <MetaItem
                  key={f.key}
                  label={f.label}
                  mono={f.kind === "date"}
                  value={
                    f.kind === "checkbox"
                      ? data[f.key] === "yes" ? "Confirmed" : "Not confirmed"
                      : f.kind === "number" && /amount|charge|emi|settled/i.test(f.label)
                        ? fmtMoney(data[f.key])
                        : data[f.key]
                  }
                />
              ))}
            </div>
            {statics.length > 0 && (
              <div className="space-y-2 border-t border-line px-5 py-4">
                {statics.map((f) => (
                  <div key={f.key} className="flex items-start gap-2.5 text-[12.5px] text-ink2">
                    <Snowflake className="mt-0.5 size-3.5 shrink-0 text-pine" />
                    <span><span className="font-medium text-ink">{f.label}:</span> {f.autoValue}</span>
                  </div>
                ))}
              </div>
            )}
            {data.basis && (
              <div className="border-t border-line px-5 py-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink3">Release basis</div>
                <p className="mt-2 font-display text-[14px] italic leading-relaxed text-ink2">{data.basis}</p>
              </div>
            )}
          </Card>

          {/* Documents */}
          <Card className="overflow-hidden">
            <div className="px-5 pt-5">
              <SectionTitle
                index="02"
                title="Document checklist"
                sub="Type-specific evidence. Mandatory items must be uploaded before the case can proceed."
                right={
                  missing.length > 0 && ["DRAFT", "ON_HOLD", "RETURNED", "QUERY"].includes(kase.status) ? (
                    <span className="rounded-full border border-red-300 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700">
                      {missing.length} mandatory missing
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 rounded-full border border-pine/30 bg-pine/5 px-2.5 py-1 text-[11px] font-medium text-pine">
                      <CircleCheck className="size-3.5" /> Complete
                    </span>
                  )
                }
              />
            </div>
            <div className="border-t border-line">
              <DocumentsPanel caseId={kase.id} rows={reqRows} canEdit={canEditDocs} />
              {otherDocs.length > 0 && (
                <div className="border-t border-line px-5 py-3">
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink3">Additional documents</div>
                  <div className="flex flex-wrap gap-1.5">
                    {otherDocs.map((d) => (
                      <a key={d.id} href={`/api/files/${d.id}`} className="inline-flex items-center gap-1.5 rounded-md border border-pine/25 bg-pine/5 px-2 py-1 text-[11px] text-pinedeep">
                        <Printer className="size-3" /> {d.fileName}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <OtherUpload caseId={kase.id} canEdit={canEditDocs} />
            </div>
          </Card>

          {/* Letter stage */}
          <Card className="overflow-hidden">
            <div className="px-5 pt-5">
              <SectionTitle
                index="03"
                title="Release letter"
                sub={
                  def.letterOwner === "initiator"
                    ? "Auto-generated after review approval — the initiator signs and uploads the completed CIB/blacklist release letter."
                    : "Generated on the CAD screen after review approval — CAD/CIC completes, digitally signs and uploads it."
                }
              />
            </div>
            <div className="border-t border-line px-5 py-5">
              {!letterStageReached ? (
                <p className="text-[13px] text-ink3">
                  The letter is generated automatically by DigiHost once the reviewing authority approves the case —
                  different formats apply for individuals and entities.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/cases/${kase.id}/letter`}
                      className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-[12.5px] font-medium text-paper transition-colors hover:bg-pinedeep"
                    >
                      <FileSignature className="size-4" /> View &amp; print generated letter
                    </Link>
                    {kase.status === "RELEASED" && (
                      <Link
                        href={`/cases/${kase.id}/release-document`}
                        className="inline-flex items-center gap-2 rounded-md border border-pine/40 bg-pine/5 px-4 py-2 text-[12.5px] font-medium text-pinedeep transition-colors hover:bg-pine/10"
                      >
                        <ShieldCheck className="size-4" /> Final release document (CAD)
                      </Link>
                    )}
                  </div>
                  <SignedLetterUpload
                    caseId={kase.id}
                    canUpload={canUploadSigned}
                    existing={signedDoc ? toDocItem(signedDoc) : null}
                    ownerIsCad={def.letterOwner === "cad"}
                  />
                </div>
              )}
            </div>
          </Card>

          {/* Timeline */}
          <Card>
            <div className="px-5 pt-5">
              <SectionTitle index="04" title="Workflow trail" sub="Immutable audit of every routing decision — “Return” means correction, “Query” means clarification." />
            </div>
            <div className="border-t border-line px-5 py-6">
              <Timeline events={eventItems} attachmentFiles={attachmentFiles} />
            </div>
          </Card>
        </div>

        {/* ------------- right rail ------------- */}
        <div className="space-y-6 lg:sticky lg:top-20">
          <Card>
            <div className="border-b border-line px-5 py-4">
              <h3 className="font-display text-[15px] font-semibold text-ink">Workflow actions</h3>
              <p className="text-[11.5px] text-ink2">{roleLabel(user.role)}</p>
            </div>
            <div className="p-4">
              <ActionPanel
                caseId={kase.id}
                actions={actions}
                forwardTargets={forwardTargets}
                signedLetterMissing={!signedDoc}
              />
            </div>
          </Card>

          <Card>
            <div className="border-b border-line px-5 py-4">
              <h3 className="font-display text-[15px] font-semibold text-ink">Routing</h3>
            </div>
            <div className="space-y-3.5 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] uppercase tracking-wider text-ink3">Initiator</span>
                {initiator && <UserChip name={initiator.name} role={initiator.unit} />}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] uppercase tracking-wider text-ink3">Reviewer</span>
                {reviewer ? (
                  <UserChip name={reviewer.name} role={reviewer.unit} />
                ) : (
                  <span className="rounded-md border border-gold/50 bg-goldsoft/30 px-2 py-1 text-[11px] font-medium text-gold">
                    BROPs pool
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] uppercase tracking-wider text-ink3">Final unit</span>
                <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink"><Landmark className="size-3.5 text-ink3" /> CAD/CIC</span>
              </div>
              {kase.cibRequestNumber && (
                <div className="rounded-md border border-violet-300 bg-violet-50 px-3 py-2">
                  <div className="text-[9.5px] font-bold uppercase tracking-wider text-violet-700">CIB request number</div>
                  <div className="mt-0.5 font-mono text-[12px] text-violet-900">{kase.cibRequestNumber}</div>
                </div>
              )}
            </div>
          </Card>

          {record && eligibility && (
            <Card>
              <div className="border-b border-line px-5 py-4">
                <h3 className="font-display text-[15px] font-semibold text-ink">Underlying blacklist</h3>
              </div>
              <div className="space-y-3 px-5 py-4 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-ink3">Record status</span>
                  <span className="font-medium text-ink">{record.status.replace(/_/g, " ")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink3">Account {record.accountNumber}</span>
                  <span className={`flex items-center gap-1.5 font-medium ${record.accountStatus === "frozen" ? "text-blue-700" : "text-pine"}`}>
                    <Snowflake className="size-3.5" /> {record.accountStatus}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink3">Freeze reason codes</span>
                  <span className="font-mono text-[11.5px] text-ink">{(record.freezeCodes ?? []).join(" + ")}</span>
                </div>
                <div className={`rounded-md border px-3 py-2.5 text-[11.5px] leading-relaxed ${eligibility.eligible ? "border-pine/30 bg-pine/5 text-pinedeep" : "border-line bg-paper2/40 text-ink2"}`}>
                  {eligibility.reason}
                </div>
                {record.temporaryUntil && (
                  <div className="rounded-md border border-cyan-300 bg-cyan-50 px-3 py-2 text-[11.5px] text-cyan-900">
                    Temporary release until <span className="font-semibold">{fmtDate(record.temporaryUntil)}</span> — expiry/re-blacklisting rule pending confirmation.
                  </div>
                )}
                {(record.parties ?? []).length > 1 && (
                  <div className="border-t border-line pt-3">
                    <div className="mb-2 text-[9.5px] font-bold uppercase tracking-wider text-ink3">Parties</div>
                    {record.parties!.map((p) => (
                      <div key={p.name + p.role} className="flex items-center justify-between py-1">
                        <span className="text-ink">{p.name}</span>
                        <span className={`text-[10px] font-medium uppercase tracking-wider ${p.released ? "text-pine" : "text-ink3"}`}>
                          {p.role}{p.released ? " · released" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}

          <div className="rounded-xl border border-gold/30 bg-goldsoft/20 p-4 text-[11.5px] leading-relaxed text-ink2">
            <span className="font-semibold text-ink">Decision rule.</span> Approval moves the case forward; Return sends it
            back for correction (remarks mandatory); Query asks for clarification (remarks mandatory);
            Reject/Cancel closes the case. At CAD/CIC, the attachment is mandatory.
          </div>
        </div>
      </div>
    </div>
  );
}

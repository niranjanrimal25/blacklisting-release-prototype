import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, eq } from "@/db";
import { db, ensureReady } from "@/db";
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
import { ActionPanel } from "@/components/case-actions";
import { DocumentsPanel, OtherUpload, SignedLetterUpload, type DocItem, type ReqRow } from "@/components/documents-panel";
import { Timeline, type EventItem } from "@/components/timeline";

export const dynamic = "force-dynamic";

export default async function Pm38CasePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  await ensureReady();
  const { id } = await params;
  const { created } = await searchParams;
  const caseId = Number(id);

  const [kase] = await db.select().from(releaseCases).where(eq(releaseCases.id, caseId)).limit(1);
  if (!kase) notFound();

  const def = RELEASE_TYPES[kase.releaseType as ReleaseTypeKey];
  const [record, docs, events, allUsers] = await Promise.all([
    kase.blacklistRecordId ? db.select().from(blacklistRecords).where(eq(blacklistRecords.id, kase.blacklistRecordId)).limit(1).then((r: any) => r[0] ?? null) : Promise.resolve(null),
    db.select().from(caseDocuments).where(eq(caseDocuments.caseId, caseId)).orderBy(asc(caseDocuments.createdAt)),
    db.select().from(caseEvents).where(eq(caseEvents.caseId, caseId)).orderBy(asc(caseEvents.createdAt)),
    db.select().from(users),
  ]);

  const initiator = allUsers.find((u: any) => u.id === kase.initiatorId);
  const reviewer = allUsers.find((u: any) => u.id === kase.reviewerId);
  const isInitiator = user.id === kase.initiatorId;
  const isReviewer = user.id === kase.reviewerId;

  const statusMeta = STATUS_META[kase.status as StatusKey];
  const signedDoc = docs.find((d: any) => d.requirementKey === "signed_letter") ?? null;
  const canEditDocs = (isInitiator && ["DRAFT","ON_HOLD","RETURNED","QUERY"].includes(kase.status)) || (user.role === "cad" && ["LETTER_PENDING","PENDING_CAD","CIB_REPORTED","CIB_RETURNED"].includes(kase.status));
  const canUploadSigned = kase.status === "LETTER_PENDING" && (def.letterOwner === "initiator" ? isInitiator : user.role === "cad");

  const toDocItem = (d: any): DocItem => ({
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
    docs: docs.filter((d: any) => d.requirementKey === r.key).map(toDocItem),
  }));

  const uploadedKeys = docs.filter((d: any) => d.requirementKey).map((d: any) => d.requirementKey as string);
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

  const forwardTargets = allUsers.filter((u: any) => ["reviewer_oi","reviewer_bm","brops"].includes(u.role) && u.id !== user.id).map((u: any) => ({ id: u.id, name: u.name, title: u.title }));

  const eligibility = record ? unfreezeEligibility(record.freezeCodes ?? []) : null;
  const data = kase.data;

  return (
    <div className="bg-white border border-[#bdc3c7]">
      {/* PM 3.8 Case Header */}
      <div className="bg-[#2c3e50] text-white px-4 py-3 flex justify-between items-center">
        <div>
          <div className="font-mono text-[11px] text-[#f8c471]">{kase.reference} | {def.label} | {statusMeta.label}</div>
          <div className="font-bold text-[16px] mt-1">{data.partyName} — {data.blacklistNumber}</div>
          <div className="text-[11px] text-white/70">Initiated {fmtDate(kase.createdAt)} by {initiator?.name} | Current: {reviewer?.name ?? (kase.routedToPool ? "BROPs Pool" : "System")}</div>
        </div>
        <div className="text-right text-[10px] font-mono">
          <div>Case ID: {kase.id}</div>
          <div>Status: {kase.status}</div>
          <div className="mt-1"><Link href={`/cases/${kase.id}`} className="bg-white text-[#2c3e50] px-2 py-1 rounded text-[11px]">Switch to Modern UI</Link></div>
        </div>
      </div>

      {created === "1" && (
        <div className="bg-[#d5f5e3] border border-[#82e0aa] px-4 py-2 text-[12px] text-[#1e8449]">
          <strong>Case created in Draft (PM 3.8 style).</strong> Complete mandatory Input Documents, then Proceed. Maker check runs on Proceed.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px]">
        {/* Main */}
        <div className="p-4 space-y-4">
          {/* Dynaform: Case Data */}
          <div className="border border-[#bdc3c7] rounded">
            <div className="bg-[#d5dbdb] px-3 py-2 font-bold text-[#2c3e50] text-[12px] border-b border-[#bdc3c7]">Dynaform: Case Data (DF_TYPE_DETAILS_*)</div>
            <div className="p-4 grid grid-cols-2 gap-4 text-[11px]">
              <div><span className="font-bold text-[#2c3e50]">Source:</span> {data.source === "digihost" ? "DigiHost auto-populated" : "Manual entry"}</div>
              <div><span className="font-bold">Blacklist No:</span> <span className="font-mono">{data.blacklistNumber}</span></div>
              <div><span className="font-bold">CIF ID:</span> <span className="font-mono">{data.cifId}</span></div>
              <div><span className="font-bold">Account:</span> <span className="font-mono">{data.accountNumber || "—"}</span></div>
              {Object.entries(data).filter(([k])=>!["partyName","blacklistNumber","cifId","accountNumber","source","caseNumber","partyType","category","freezeCodes","basis"].includes(k)).slice(0,8).map(([k,v])=>(
                <div key={k}><span className="font-bold">{k}:</span> {String(v).slice(0,60)}</div>
              ))}
            </div>
            {data.basis && <div className="border-t border-[#e5e8e8] p-3 text-[11px]"><strong>Basis:</strong> {data.basis}</div>}
          </div>

          {/* Input Documents */}
          <div className="border border-[#bdc3c7] rounded">
            <div className="bg-[#d5dbdb] px-3 py-2 font-bold text-[#2c3e50] text-[12px] border-b border-[#bdc3c7] flex justify-between">
              <span>Input Documents – Mandatory Checklist (PM 3.8)</span>
              {missing.length>0 ? <span className="bg-[#e74c3c] text-white px-2 py-0.5 rounded text-[10px]">{missing.length} missing</span> : <span className="bg-[#27ae60] text-white px-2 py-0.5 rounded text-[10px]">Complete</span>}
            </div>
            <DocumentsPanel caseId={kase.id} rows={reqRows} canEdit={canEditDocs} />
            <OtherUpload caseId={kase.id} canEdit={canEditDocs} />
          </div>

          {/* Output Documents */}
          <div className="border border-[#bdc3c7] rounded">
            <div className="bg-[#d5dbdb] px-3 py-2 font-bold text-[#2c3e50] text-[12px] border-b border-[#bdc3c7]">Output Documents – CIB Letters</div>
            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <Link href={`/cases/${kase.id}/letter`} className="bg-[#2e86c1] text-white px-3 py-1.5 rounded text-[11px]">View OD_CIB_RELEASE_LETTER (PDF)</Link>
                {kase.status === "RELEASED" && <Link href={`/cases/${kase.id}/release-document`} className="bg-[#27ae60] text-white px-3 py-1.5 rounded text-[11px]">OD_FINAL_RELEASE_DOCUMENT</Link>}
              </div>
              <SignedLetterUpload caseId={kase.id} canUpload={canUploadSigned} existing={signedDoc ? toDocItem(signedDoc) : null} ownerIsCad={def.letterOwner === "cad"} />
            </div>
          </div>

          {/* Case History (PM 3.8 Case Tracker) */}
          <div className="border border-[#bdc3c7] rounded">
            <div className="bg-[#d5dbdb] px-3 py-2 font-bold text-[#2c3e50] text-[12px] border-b border-[#bdc3c7]">Case Tracker – Audit Trail (Immutable)</div>
            <div className="p-4">
              <Timeline events={events.map((e:any)=>({ id:e.id, action:e.action, actorName:e.actorName, fromStatus:e.fromStatus, toStatus:e.toStatus, remarks:e.remarks, attachmentDocId:e.attachmentDocId, meta:e.meta ?? {}, createdAt:e.createdAt }))} attachmentFiles={Object.fromEntries(docs.filter((d:any)=>d.fileName).map((d:any)=>[d.id,{fileName:d.fileName}]))} />
            </div>
          </div>
        </div>

        {/* Right – Actions */}
        <div className="bg-[#f2f3f4] border-l border-[#bdc3c7] p-3 space-y-4">
          <div className="border border-[#bdc3c7] bg-white rounded">
            <div className="bg-[#2c3e50] text-white px-3 py-2 font-bold text-[11px]">Workflow Actions (PM 3.8 Triggers)</div>
            <div className="p-3">
              <div className="text-[10px] text-[#7f8c8d] mb-2">{roleLabel(user.role)} | Case {kase.reference}</div>
              <ActionPanel caseId={kase.id} actions={actions} forwardTargets={forwardTargets} signedLetterMissing={!signedDoc} />
            </div>
          </div>

          <div className="border border-[#bdc3c7] bg-white rounded">
            <div className="bg-[#d5dbdb] px-3 py-2 font-bold text-[11px]">Routing Info</div>
            <div className="p-3 text-[11px] space-y-2">
              <div className="flex justify-between"><span>Initiator:</span><span className="font-bold">{initiator?.name}</span></div>
              <div className="flex justify-between"><span>Reviewer:</span><span className="font-bold">{reviewer?.name ?? (kase.routedToPool ? "BROPs Pool" : "—")}</span></div>
              <div className="flex justify-between"><span>Final:</span><span>CAD/CIC</span></div>
              {kase.cibRequestNumber && <div className="bg-[#eaf2f8] border border-[#aed6f1] p-2 font-mono text-[10px]">CIB Req: {kase.cibRequestNumber}</div>}
            </div>
          </div>

          {record && eligibility && (
            <div className="border border-[#bdc3c7] bg-white rounded">
              <div className="bg-[#d5dbdb] px-3 py-2 font-bold text-[11px]">PM Table: BLACKLIST_REGISTER</div>
              <div className="p-3 text-[11px] space-y-1">
                <div>Status: {record.status}</div>
                <div>Account: {record.accountNumber} – {record.accountStatus}</div>
                <div>Freeze: {(record.freezeCodes ?? []).join(" + ")}</div>
                <div className={`p-2 border rounded text-[10px] ${eligibility.eligible ? "bg-[#d5f5e3] border-[#82e0aa]" : "bg-[#f2f3f4] border-[#e5e8e8]"}`}>{eligibility.reason}</div>
              </div>
            </div>
          )}

          <div className="bg-[#fef9e7] border border-[#f9e79f] p-3 text-[10.5px] text-[#7d6608]">
            <strong>PM 3.8 Triggers executed:</strong><br/>
            - TRG_LOOKUP_BLACKLIST<br/>
            - TRG_MAKER_COMPLETENESS_CHECK<br/>
            - TRG_VALIDATE_REVIEW<br/>
            - TRG_CHECK_SIGNED_LETTER<br/>
            - TRG_RELEASE_BLACKLIST (auto-unfreeze 002/025/100)
          </div>
        </div>
      </div>
    </div>
  );
}

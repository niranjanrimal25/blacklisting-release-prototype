/**
 * Workflow engine: every state transition, validation rule and side effect
 * (letter generation, notifications, party-level release, auto-unfreeze)
 * lives here so routes and actions share one audited path.
 */
import { db } from "@/db";
import {
  blacklistRecords,
  caseDocuments,
  caseEvents,
  notifications,
  releaseCases,
  users,
  type Party,
} from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import {
  RELEASE_TYPES,
  missingRequiredDocs,
  unfreezeEligibility,
  type ActionKey,
  type ReleaseTypeKey,
} from "@/lib/workflow";
import type { SessionUser } from "@/lib/session";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export type CaseRow = typeof releaseCases.$inferSelect;
export type RecordRow = typeof blacklistRecords.$inferSelect;
export type DocRow = typeof caseDocuments.$inferSelect;
export type EventRow = typeof caseEvents.$inferSelect;
export type UserRow = typeof users.$inferSelect;

export async function logEvent(e: {
  caseId: number;
  actor?: { id: string; name: string; role: string } | null;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  remarks?: string | null;
  attachmentDocId?: number | null;
  meta?: Record<string, string>;
}) {
  await db.insert(caseEvents).values({
    caseId: e.caseId,
    actorId: e.actor?.id ?? null,
    actorName: e.actor?.name ?? "DigiHost System",
    actorRole: e.actor?.role ?? "system",
    action: e.action,
    fromStatus: e.fromStatus ?? null,
    toStatus: e.toStatus ?? null,
    remarks: e.remarks ?? null,
    attachmentDocId: e.attachmentDocId ?? null,
    meta: e.meta ?? {},
  });
}

export async function notify(userIds: string[], caseId: number, message: string) {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (!unique.length) return;
  await db.insert(notifications).values(unique.map((userId) => ({ userId, caseId, message })));
}

export async function cadUserIds(): Promise<string[]> {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.role, "cad"));
  return rows.map((r) => r.id);
}

export async function bropsUserIds(): Promise<string[]> {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.role, "brops"));
  return rows.map((r) => r.id);
}

/* ------------------------------- documents -------------------------------- */

export async function saveDocument(opts: {
  caseId: number;
  requirementKey: string | null;
  label: string;
  file: File | null;
  source: "uploaded" | "carried" | "system";
  uploadedBy?: string | null;
}): Promise<DocRow> {
  let fileName: string | null = null;
  let filePath: string | null = null;
  let mimeType: string | null = null;
  let size: number | null = null;

  if (opts.file && opts.file.size > 0) {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const safe = opts.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    fileName = opts.file.name;
    filePath = path.join(UPLOAD_DIR, `${randomUUID()}-${safe}`);
    mimeType = opts.file.type || "application/octet-stream";
    size = opts.file.size;
    const buf = Buffer.from(await opts.file.arrayBuffer());
    await writeFile(filePath, buf);
  }

  // remove prior upload for the same requirement so the latest file wins
  if (opts.requirementKey) {
    await db
      .delete(caseDocuments)
      .where(
        and(
          eq(caseDocuments.caseId, opts.caseId),
          eq(caseDocuments.requirementKey, opts.requirementKey),
          ne(caseDocuments.source, "carried")
        )
      );
  }

  const [doc] = await db
    .insert(caseDocuments)
    .values({
      caseId: opts.caseId,
      requirementKey: opts.requirementKey,
      label: opts.label,
      fileName,
      filePath,
      mimeType,
      size,
      source: opts.source,
      uploadedBy: opts.uploadedBy ?? null,
    })
    .returning();
  return doc;
}

/* ------------------------------- transitions ------------------------------ */

type ActionPayload = {
  remarks?: string;
  forwardTo?: string;
  requestNumber?: string;
  attachment?: File | null;
};

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

export async function performCaseAction(
  user: SessionUser,
  caseId: number,
  action: ActionKey,
  payload: ActionPayload
): Promise<ActionResult> {
  const [kase] = await db.select().from(releaseCases).where(eq(releaseCases.id, caseId)).limit(1);
  if (!kase) return { ok: false, error: "Case not found." };
  const def = RELEASE_TYPES[kase.releaseType as ReleaseTypeKey];
  if (!def) return { ok: false, error: "Unknown release type." };
  const [record] = kase.blacklistRecordId
    ? await db.select().from(blacklistRecords).where(eq(blacklistRecords.id, kase.blacklistRecordId)).limit(1)
    : [undefined];

  const status = kase.status;
  const isInitiator = user.id === kase.initiatorId;
  const isReviewer = user.id === kase.reviewerId;
  const remarks = (payload.remarks ?? "").trim();
  const actor = { id: user.id, name: user.name, role: user.role };

  const fail = (error: string): ActionResult => ({ ok: false, error });
  const touch = { updatedAt: new Date() };

  const ref = kase.reference;

  switch (action as ActionKey) {
    /* ------------------------------- initiator ------------------------------ */
    case "HOLD": {
      if (!isInitiator || status !== "DRAFT") return fail("Hold is only available to the initiator while the case is in Draft.");
      await db.update(releaseCases).set({ status: "ON_HOLD", ...touch }).where(eq(releaseCases.id, caseId));
      await logEvent({ caseId, actor, action: "HELD", fromStatus: status, toStatus: "ON_HOLD" });
      return { ok: true, message: "Case placed on hold." };
    }
    case "RESUME": {
      if (!isInitiator || status !== "ON_HOLD") return fail("Resume is only available while the case is On Hold.");
      await db.update(releaseCases).set({ status: "DRAFT", ...touch }).where(eq(releaseCases.id, caseId));
      await logEvent({ caseId, actor, action: "RESUMED", fromStatus: status, toStatus: "DRAFT" });
      return { ok: true, message: "Case resumed." };
    }
    case "CANCEL_CASE": {
      if (!isInitiator) return fail("Only the initiator can cancel this case.");
      if (!["DRAFT", "ON_HOLD", "RETURNED", "QUERY", "LETTER_PENDING"].includes(status))
        return fail("This case can no longer be cancelled at its current stage.");
      await db.update(releaseCases).set({ status: "CANCELLED", closedAt: new Date(), ...touch }).where(eq(releaseCases.id, caseId));
      await logEvent({ caseId, actor, action: "CANCELLED", fromStatus: status, toStatus: "CANCELLED" });
      return { ok: true, message: "Case cancelled." };
    }
    case "PROCEED": {
      if (!isInitiator || !["DRAFT", "ON_HOLD"].includes(status)) return fail("Proceed is only available on a Draft/On-Hold case you initiated.");
      const docs = await db.select().from(caseDocuments).where(eq(caseDocuments.caseId, caseId));
      const keys = docs.filter((d) => d.requirementKey).map((d) => d.requirementKey as string);
      const missing = missingRequiredDocs(def.key, keys);
      if (missing.length)
        return fail(`Mandatory documents missing: ${missing.map((m) => m.label).join("; ")}. Upload them to pass the maker completeness check.`);
      const toPool = kase.routedToPool && !kase.reviewerId;
      await db.update(releaseCases).set({ status: "PENDING_REVIEW", submittedAt: new Date(), ...touch }).where(eq(releaseCases.id, caseId));
      await logEvent({ caseId, actor, action: "SUBMITTED", fromStatus: status, toStatus: "PENDING_REVIEW" });
      if (toPool) {
        await notify(await bropsUserIds(), caseId, `${ref} submitted to the BROPs pool by ${user.name} — claim to review.`);
      } else if (kase.reviewerId) {
        await notify([kase.reviewerId], caseId, `${ref} submitted by ${user.name} for your review.`);
      }
      return { ok: true, message: "Case submitted to the reviewing authority." };
    }
    case "FORWARD_AFTER_RETURN": {
      if (!isInitiator || !["RETURNED", "QUERY"].includes(status))
        return fail("Forward after return is only available on a case returned to you or queried.");
      await db.update(releaseCases).set({ status: "PENDING_REVIEW", ...touch }).where(eq(releaseCases.id, caseId));
      await logEvent({
        caseId, actor, action: status === "QUERY" ? "QUERY_ANSWERED" : "RESUBMITTED",
        fromStatus: status, toStatus: "PENDING_REVIEW", remarks: remarks || null,
      });
      if (kase.reviewerId) await notify([kase.reviewerId], caseId, `${ref} resubmitted by ${user.name} after correction/clarification.`);
      else if (kase.routedToPool) await notify(await bropsUserIds(), caseId, `${ref} resubmitted to the BROPs pool by ${user.name}.`);
      return { ok: true, message: "Case resubmitted to the reviewer." };
    }
    case "SUBMIT_TO_CAD": {
      const ownerOk = def.letterOwner === "initiator" ? isInitiator : user.role === "cad";
      if (status !== "LETTER_PENDING" || !ownerOk) return fail("The case is not awaiting a signed release letter from you.");
      const docs = await db.select().from(caseDocuments).where(eq(caseDocuments.caseId, caseId));
      const signed = docs.find((d) => d.requirementKey === "signed_letter");
      if (!signed) return fail("Upload the signed/digitally-signed CIB Release Letter before submitting to CAD/CIC.");
      await db.update(releaseCases).set({ status: "PENDING_CAD", letterStatus: "signed", ...touch }).where(eq(releaseCases.id, caseId));
      await logEvent({ caseId, actor, action: "SUBMITTED_TO_CAD", fromStatus: status, toStatus: "PENDING_CAD", meta: { letter: "signed_uploaded" } });
      await notify(await cadUserIds(), caseId, `${ref}: signed release letter uploaded — case awaits CAD/CIC final validation.`);
      return { ok: true, message: "Case submitted to CAD/CIC for final validation." };
    }

    /* -------------------------------- BROPs pool ---------------------------- */
    case "CLAIM": {
      if (user.role !== "brops" || status !== "PENDING_REVIEW" || !kase.routedToPool || kase.reviewerId)
        return fail("This case is not available in the BROPs pool.");
      await db.update(releaseCases).set({ reviewerId: user.id, ...touch }).where(eq(releaseCases.id, caseId));
      await logEvent({ caseId, actor, action: "CLAIMED", fromStatus: status, toStatus: status, remarks: "Claimed from the BROPs pool and assigned." });
      await notify([kase.initiatorId], caseId, `${ref} was claimed from the BROPs pool by ${user.name}.`);
      return { ok: true, message: "Case claimed and assigned to you." };
    }

    /* ------------------------------- reviewer ------------------------------- */
    case "APPROVE":
    case "FORWARD":
    case "RETURN":
    case "QUERY":
    case "REJECT": {
      if (!isReviewer || status !== "PENDING_REVIEW") return fail("This case is not pending your review.");
      if ((action === "RETURN" || action === "QUERY" || action === "REJECT") && !remarks)
        return fail("Remarks are mandatory for Return / Query / Reject at reviewer level.");
      if (action === "FORWARD") {
        const target = (payload.forwardTo ?? "").trim();
        if (!target) return fail("Select the authority to forward the case to.");
        const [t] = await db.select().from(users).where(eq(users.id, target)).limit(1);
        if (!t) return fail("Forwarding target not found.");
        await db.update(releaseCases).set({ reviewerId: target, routedToPool: false, ...touch }).where(eq(releaseCases.id, caseId));
        await logEvent({ caseId, actor, action: "FORWARDED", fromStatus: status, toStatus: status, remarks: remarks || null, meta: { to: t.name } });
        await notify([target], caseId, `${ref} forwarded to you by ${user.name} for review.`);
        return { ok: true, message: `Case forwarded to ${t.name}.` };
      }
      if (action === "RETURN" || action === "QUERY") {
        const to = action === "RETURN" ? "RETURNED" : "QUERY";
        await db.update(releaseCases).set({ status: to, ...touch }).where(eq(releaseCases.id, caseId));
        await logEvent({ caseId, actor, action: to, fromStatus: status, toStatus: to, remarks });
        await notify([kase.initiatorId], caseId, `${ref} ${action === "RETURN" ? "returned for rectification" : "queried"} by ${user.name}: “${remarks}”`);
        return { ok: true, message: action === "RETURN" ? "Case returned to the initiator." : "Query raised with the initiator." };
      }
      if (action === "REJECT") {
        await db.update(releaseCases).set({ status: "REJECTED", closedAt: new Date(), ...touch }).where(eq(releaseCases.id, caseId));
        await logEvent({ caseId, actor, action: "REJECTED", fromStatus: status, toStatus: "REJECTED", remarks });
        await notify([kase.initiatorId], caseId, `${ref} rejected by ${user.name}: “${remarks}”`);
        return { ok: true, message: "Case rejected and closed." };
      }
      // APPROVE → letter stage
      await db.update(releaseCases).set({ status: "LETTER_PENDING", letterStatus: "generated", ...touch }).where(eq(releaseCases.id, caseId));
      await logEvent({ caseId, actor, action: "APPROVED", fromStatus: status, toStatus: "LETTER_PENDING", remarks: remarks || null });
      if (def.letterOwner === "initiator") {
        await logEvent({ caseId, actor: null, action: "LETTER_GENERATED", toStatus: "LETTER_PENDING", remarks: "Blacklist release letter auto-generated and made available to the initiator." });
        await notify([kase.initiatorId], caseId, `${ref} approved by ${user.name}. Release letter generated — download, sign and upload it.`);
      } else {
        await logEvent({ caseId, actor: null, action: "LETTER_GENERATED", toStatus: "LETTER_PENDING", remarks: "CIB Release Letter generated on the CAD screen." });
        await notify(await cadUserIds(), caseId, `${ref} approved at review. CIB Release Letter awaits completion/signing on the CAD screen.`);
      }
      return { ok: true, message: "Approved — case moved to the release-letter stage." };
    }

    /* -------------------------------- CAD/CIC ------------------------------- */
    case "RELEASE": {
      if (user.role !== "cad" || !["PENDING_CAD", "CIB_REPORTED"].includes(status))
        return fail("Release Blacklist is only available to CAD/CIC during final validation.");
      const docs = await db.select().from(caseDocuments).where(eq(caseDocuments.caseId, caseId));
      if (!docs.find((d) => d.requirementKey === "signed_letter"))
        return fail("The signed CIB Release Letter is not on file — final validation cannot pass.");
      const now = new Date();
      await db.update(releaseCases).set({ status: "RELEASED", releasedAt: now, closedAt: now, ...touch }).where(eq(releaseCases.id, caseId));
      await logEvent({ caseId, actor, action: "BLACKLIST_RELEASED", fromStatus: status, toStatus: "RELEASED", remarks: "Final validation passed — blacklist release executed by CAD/CIC." });

      if (record) {
        const codes = record.freezeCodes ?? [];
        if (def.key === "partial") {
          const gname = (kase.data.guarantorName ?? "").toLowerCase();
          const parties: Party[] = (record.parties ?? []).map((p) =>
            p.role === "guarantor" && (gname === "" || p.name.toLowerCase().includes(gname) || gname.includes(p.name.toLowerCase()))
              ? { ...p, released: true }
              : p
          );
          await db.update(blacklistRecords).set({ parties, status: "partially_released" }).where(eq(blacklistRecords.id, record.id));
          await logEvent({ caseId, actor: null, action: "PARTY_RELEASED", remarks: `Guarantor "${kase.data.guarantorName ?? "—"}" released at party level; borrower ${kase.data.borrowerName ?? record.partyName} remains blacklisted.` });
        } else if (def.key === "temporary") {
          const until = new Date(now);
          until.setMonth(until.getMonth() + 6);
          await db.update(blacklistRecords).set({ status: "temporary_released", releasedAt: now, temporaryUntil: until }).where(eq(blacklistRecords.id, record.id));
          await logEvent({ caseId, actor: null, action: "TEMPORARY_RELEASE_RECORDED", remarks: "Temporary release recorded for six months based on the EMI payment plan.", meta: { until: until.toISOString().slice(0, 10) } });
        } else {
          await db.update(blacklistRecords).set({ status: "released", releasedAt: now }).where(eq(blacklistRecords.id, record.id));
        }

        // Auto-unfreeze: only after release, single reason code 002/025/100
        if (def.key !== "partial") {
          const eligibility = unfreezeEligibility(codes);
          if (eligibility.eligible) {
            await db.update(blacklistRecords).set({ accountStatus: "unfrozen" }).where(eq(blacklistRecords.id, record.id));
            await logEvent({ caseId, actor: null, action: "AUTO_UNFROZEN", remarks: `Account ${record.accountNumber ?? "—"} unfrozen automatically. ${eligibility.reason}` });
          } else {
            await logEvent({ caseId, actor: null, action: "AUTO_UNFREEZE_SKIPPED", remarks: eligibility.reason });
          }
        } else {
          await logEvent({ caseId, actor: null, action: "AUTO_UNFREEZE_SKIPPED", remarks: "Partial release — account remains frozen for the borrower; guarantor release handled at party level (rule pending confirmation)." });
        }
      }
      await notify([kase.initiatorId], caseId, `${ref}: blacklist released by CAD/CIC. The final release document is available for download.`);
      return { ok: true, message: "Blacklist released. Eligible auto-unfreeze evaluated and applied." };
    }
    case "CAD_RETURN":
    case "CAD_QUERY": {
      if (user.role !== "cad" || !["PENDING_CAD", "CIB_REPORTED", "CIB_RETURNED"].includes(status))
        return fail("This action is only available to CAD/CIC during final validation.");
      if (!remarks) return fail("Remarks are mandatory.");
      if (!payload.attachment || payload.attachment.size === 0) return fail("An attachment is mandatory for Return/Query at CAD/CIC level.");
      const doc = await saveDocument({
        caseId, requirementKey: null,
        label: `CAD/CIC ${action === "CAD_RETURN" ? "Return" : "Query"} attachment`,
        file: payload.attachment, source: "uploaded", uploadedBy: user.id,
      });
      const to = action === "CAD_RETURN" ? "RETURNED" : "QUERY";
      await db.update(releaseCases).set({ status: to, ...touch }).where(eq(releaseCases.id, caseId));
      await logEvent({ caseId, actor, action: to, fromStatus: status, toStatus: to, remarks, attachmentDocId: doc.id });
      await notify([kase.initiatorId], caseId, `${ref} ${action === "CAD_RETURN" ? "returned" : "queried"} by CAD/CIC: “${remarks}”`);
      return { ok: true, message: action === "CAD_RETURN" ? "Case returned with attachment." : "Query raised with attachment." };
    }
    case "CIB_RETURNED": {
      if (user.role !== "cad" || status !== "PENDING_CAD") return fail("Available only to CAD/CIC during final validation.");
      if (!payload.attachment || payload.attachment.size === 0) return fail("Attach the CIB return feedback/document — attachment is mandatory.");
      const doc = await saveDocument({ caseId, requirementKey: null, label: "Returned by CIB — feedback", file: payload.attachment, source: "uploaded", uploadedBy: user.id });
      await db.update(releaseCases).set({ status: "CIB_RETURNED", ...touch }).where(eq(releaseCases.id, caseId));
      await logEvent({ caseId, actor, action: "RETURNED_BY_CIB", fromStatus: status, toStatus: "CIB_RETURNED", remarks: remarks || null, attachmentDocId: doc.id });
      await notify([kase.initiatorId], caseId, `${ref} was returned by CIB — feedback attached by CAD/CIC.`);
      return { ok: true, message: "CIB return recorded with evidence." };
    }
    case "CIB_REPORTED": {
      if (user.role !== "cad" || !["PENDING_CAD", "CIB_REPORTED"].includes(status)) return fail("Available only to CAD/CIC during final validation.");
      const req = (payload.requestNumber ?? "").trim();
      if (!req || !remarks) return fail("Request Number and remarks are mandatory for Reported to CIB.");
      await db.update(releaseCases).set({ status: "CIB_REPORTED", cibRequestNumber: req, ...touch }).where(eq(releaseCases.id, caseId));
      await logEvent({ caseId, actor, action: "REPORTED_TO_CIB", fromStatus: status, toStatus: "CIB_REPORTED", remarks, meta: { requestNumber: req } });
      await notify([kase.initiatorId], caseId, `${ref} reported to CIB (Request No. ${req}).`);
      return { ok: true, message: "CIB reporting reference recorded." };
    }
    case "RESUME_VALIDATION": {
      if (user.role !== "cad" || status !== "CIB_RETURNED") return fail("Resume is only available after a CIB return.");
      await db.update(releaseCases).set({ status: "PENDING_CAD", ...touch }).where(eq(releaseCases.id, caseId));
      await logEvent({ caseId, actor, action: "VALIDATION_RESUMED", fromStatus: status, toStatus: "PENDING_CAD", remarks: remarks || null });
      return { ok: true, message: "Case resumed into CAD/CIC validation." };
    }
    default:
      return fail("Unknown action.");
  }
}

/* ------------------------------ case creation ----------------------------- */

export type NewCasePayload = {
  recordId?: number;
  manual?: {
    partyName: string; partyType: string; cifId: string; blacklistNumber: string;
    accountNumber?: string; category: string; reason?: string; freezeCode?: string;
  };
  releaseType: ReleaseTypeKey;
  reviewerId: string | null;
  routedToPool: boolean;
  data: Record<string, string>;
};

export async function createCase(user: SessionUser, p: NewCasePayload): Promise<{ ok: boolean; error?: string; caseId?: number }> {
  const def = RELEASE_TYPES[p.releaseType];
  if (!def) return { ok: false, error: "Select a valid release type." };

  let recordId = p.recordId ?? null;
  let snapshot: Record<string, string> = {};

  if (!recordId) {
    if (!p.manual?.partyName || !p.manual?.cifId || !p.manual?.blacklistNumber)
      return { ok: false, error: "Manual entry requires party name, CIF ID and Blacklist Number." };
    const [rec] = await db.insert(blacklistRecords).values({
      caseNumber: null,
      blacklistNumber: p.manual.blacklistNumber.trim(),
      cifId: p.manual.cifId.trim(),
      source: "manual",
      partyName: p.manual.partyName.trim(),
      partyType: p.manual.partyType || "individual",
      accountNumber: p.manual.accountNumber || null,
      category: p.manual.category || "cheque",
      reason: p.manual.reason || "Manually recorded blacklist case",
      freezeCodes: p.manual.freezeCode ? [p.manual.freezeCode] : ["002"],
    }).returning();
    recordId = rec.id;
    snapshot = { source: "manual", caseNumber: "", blacklistNumber: rec.blacklistNumber, cifId: rec.cifId, partyName: rec.partyName, partyType: rec.partyType, accountNumber: rec.accountNumber ?? "", category: rec.category, freezeCodes: (rec.freezeCodes ?? []).join(", ") };
  } else {
    const [rec] = await db.select().from(blacklistRecords).where(eq(blacklistRecords.id, recordId)).limit(1);
    if (!rec) return { ok: false, error: "Underlying blacklist record not found." };
    snapshot = { source: rec.source, caseNumber: rec.caseNumber ?? "", blacklistNumber: rec.blacklistNumber, cifId: rec.cifId, partyName: rec.partyName, partyType: rec.partyType, accountNumber: rec.accountNumber ?? "", category: rec.category, freezeCodes: (rec.freezeCodes ?? []).join(", ") };
  }

  // Field-level validation per release type
  const data: Record<string, string> = {};
  for (const f of def.fields) {
    if (f.kind === "static") { data[f.key] = f.autoValue ?? ""; continue; }
    const v = (p.data[f.key] ?? "").trim();
    if (f.required && (!v || (f.kind === "checkbox" && v !== "yes")))
      return { ok: false, error: `"${f.label}" is required for ${def.short}.` };
    data[f.key] = v;
  }

  const [inserted] = await db.insert(releaseCases).values({
    reference: "TMP-" + randomUUID().slice(0, 8),
    blacklistRecordId: recordId,
    releaseType: def.key,
    status: "DRAFT",
    initiatorId: user.id,
    reviewerId: p.routedToPool ? null : p.reviewerId,
    routedToPool: p.routedToPool,
    data: { ...snapshot, ...data, reviewerNote: "" },
  }).returning();

  const reference = `BR-${new Date().getFullYear()}-${String(inserted.id).padStart(4, "0")}`;
  await db.update(releaseCases).set({ reference }).where(eq(releaseCases.id, inserted.id));

  await logEvent({
    caseId: inserted.id, actor: { id: user.id, name: user.name, role: user.role },
    action: "CREATED", fromStatus: null, toStatus: "DRAFT",
    remarks: `Case initiated via ${snapshot.source === "digihost" ? "DigiHost auto-population" : "manual entry"} — ${def.label}.`,
  });

  // Carry forward prior-process documents for DigiHost cases
  if (recordId) {
    const [rec] = await db.select().from(blacklistRecords).where(eq(blacklistRecords.id, recordId)).limit(1);
    if (rec && rec.documents?.length) {
      const hasPrior = def.documents.some((d) => d.key === "prior_docs");
      await db.insert(caseDocuments).values(
        rec.documents.map((d) => ({
          caseId: inserted.id,
          requirementKey: hasPrior ? "prior_docs" : null,
          label: d.name,
          fileName: d.note ?? d.name,
          source: "carried" as const,
          uploadedBy: null,
        }))
      );
      await logEvent({ caseId: inserted.id, actor: null, action: "DATA_AUTOPOPULATED", remarks: `Blacklist data and ${rec.documents.length} document(s) retrieved from DigiHost case ${rec.caseNumber ?? rec.blacklistNumber}.` });
    }
  }

  if (p.routedToPool) await notify(await bropsUserIds(), inserted.id, `${reference} (${def.short}) created — routed to the BROPs pool pending submission.`);
  else if (p.reviewerId) await notify([p.reviewerId], inserted.id, `${reference} (${def.short}) is being prepared and will arrive for your review.`);

  return { ok: true, caseId: inserted.id };
}

/* --------------------------------- lookup --------------------------------- */

export async function lookupBlacklist(identifier: string) {
  const q = identifier.trim();
  if (!q) return null;
  const rows = await db.select().from(blacklistRecords);
  const lower = q.toLowerCase();
  return (
    rows.find((r) => r.caseNumber?.toLowerCase() === lower) ??
    rows.find((r) => r.blacklistNumber.toLowerCase() === lower) ??
    rows.find((r) => r.cifId.toLowerCase() === lower) ??
    rows.find(
      (r) =>
        r.caseNumber?.toLowerCase().includes(lower) ||
        r.blacklistNumber.toLowerCase().includes(lower) ||
        r.cifId.toLowerCase().includes(lower) ||
        r.partyName.toLowerCase().includes(lower)
    ) ??
    null
  );
}



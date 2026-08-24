import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { CircleCheck, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { blacklistRecords, caseEvents, releaseCases } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { RELEASE_TYPES, fmtDate, fmtDateTime, unfreezeEligibility, type ReleaseTypeKey } from "@/lib/workflow";
import { PrintBar } from "@/components/print-button";

export const dynamic = "force-dynamic";

export default async function ReleaseDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id } = await params;

  const [kase] = await db.select().from(releaseCases).where(eq(releaseCases.id, Number(id))).limit(1);
  if (!kase || kase.status !== "RELEASED") notFound();

  const def = RELEASE_TYPES[kase.releaseType as ReleaseTypeKey];
  const d = kase.data;
  const record = kase.blacklistRecordId
    ? (await db.select().from(blacklistRecords).where(eq(blacklistRecords.id, kase.blacklistRecordId)).limit(1))[0]
    : null;
  const events = await db.select().from(caseEvents).where(eq(caseEvents.caseId, kase.id)).orderBy(asc(caseEvents.createdAt));
  const releaseEvent = events.find((e) => e.action === "BLACKLIST_RELEASED");
  const unfreezeEvent = events.find((e) => e.action === "AUTO_UNFROZEN" || e.action === "AUTO_UNFREEZE_SKIPPED");
  const eligibility = record ? unfreezeEligibility(record.freezeCodes ?? []) : null;

  return (
    <div className="-mx-8 -my-8 min-h-screen bg-paper2/60">
      <PrintBar label="Final release document" />
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="print-page relative border border-line bg-white px-12 py-12 shadow-xl shadow-ink/10 sm:px-16">
          <div className="pointer-events-none absolute inset-6 rounded border-2 border-pine/15" />
          <div className="relative">
            <div className="flex items-start justify-between border-b-2 border-pinedeep pb-6">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-md bg-pinedeep">
                  <ShieldCheck className="size-6 text-white" />
                </div>
                <div>
                  <div className="font-display text-[19px] font-bold tracking-tight text-ink">Final Blacklist Release Document</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-ink3">Provided by CAD/CIC · System record of release</div>
                </div>
              </div>
              <div className="text-right font-mono text-[11px] text-ink2">
                <div>{kase.reference}</div>
                <div>{releaseEvent ? fmtDateTime(releaseEvent.createdAt) : fmtDate(kase.releasedAt)}</div>
              </div>
            </div>

            <div className="mt-8 flex items-center gap-3 rounded-lg border border-pine/30 bg-pine/5 px-5 py-4">
              <CircleCheck className="size-6 text-pine" />
              <div>
                <div className="font-display text-[16px] font-semibold text-pinedeep">Blacklist release completed</div>
                <div className="text-[11.5px] text-ink2">Final CAD/CIC validation passed; the release was executed in-system and this outcome document is retained with the case.</div>
              </div>
            </div>

            <table className="mt-6 w-full border-collapse text-[11.5px]">
              <tbody>
                {[
                  ["Party", `${d.partyName} (${d.partyType === "entity" ? "entity" : "individual"})`],
                  ["CIF ID", d.cifId],
                  ["Blacklist number", d.blacklistNumber],
                  ["Release type", def.label],
                  ["Account number", d.accountNumber || "—"],
                  ["Freeze reason code(s)", d.freezeCodes || "—"],
                  ["Released at", fmtDateTime(kase.releasedAt)],
                  ["Released by", releaseEvent?.actorName ?? "CAD/CIC"],
                  ...(d.guarantorName ? [["Partial release", `Guarantor ${d.guarantorName} released at party level — borrower ${d.borrowerName ?? d.partyName} remains blacklisted.`]] : []),
                  ...(d.periodMonths ? [["Temporary period", "Six (6) months from release date, based on the EMI payment plan"]] : []),
                ].map(([k, v]) => (
                  <tr key={k as string}>
                    <td className="w-52 border border-line bg-paper2/50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink2">{k}</td>
                    <td className="border border-line px-3 py-2 text-ink">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-6 space-y-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink3">Account unfreezing outcome</div>
              {unfreezeEvent ? (
                <div className={`rounded-lg border px-4 py-3.5 text-[12.5px] leading-relaxed ${unfreezeEvent.action === "AUTO_UNFROZEN" ? "border-pine/30 bg-pine/5 text-pinedeep" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
                  {unfreezeEvent.remarks}
                </div>
              ) : (
                eligibility && <div className="rounded-lg border border-line bg-paper2/40 px-4 py-3.5 text-[12.5px] text-ink2">{eligibility.reason}</div>
              )}
              <p className="text-[10.5px] leading-relaxed text-ink3">
                Control note: automatic unfreezing is triggered only after a successful CAD/CIC blacklist-release action
                and only where the account carries a single freeze reason code 002, 025 or 100. All other cases route
                through the applicable separate/manual control.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-10">
              <div>
                <div className="border-t border-ink/40 pt-2 text-[10.5px] text-ink2">
                  Initiator acknowledgement — final document downloaded
                </div>
              </div>
              <div className="text-center">
                <div className="font-script text-[30px] leading-none text-pinedeep">CAD/CIC Officer</div>
                <div className="mt-1 border-t border-ink/40 px-6 pt-2 text-[10.5px] text-ink2">
                  Credit Administration / CIC — digitally executed
                </div>
              </div>
            </div>

            <div className="mt-10 border-t border-line pt-4 text-[9.5px] text-ink3">
              Generated and stored by DigiHost upon completion of the blacklist release workflow. The initiator downloads
              this final document; supporting documents are retained with the case record.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

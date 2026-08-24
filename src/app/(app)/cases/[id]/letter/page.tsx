import { notFound, redirect } from "next/navigation";
import { eq } from "@/db";
import { ShieldCheck } from "lucide-react";
import { db, ensureReady } from "@/db";
import { releaseCases, users } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { RELEASE_TYPES, fmtDate, fmtMoney, type ReleaseTypeKey } from "@/lib/workflow";
import { PrintBar } from "@/components/print-button";

export const dynamic = "force-dynamic";

export default async function LetterPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  await ensureReady();
  const { id } = await params;

  const [kase] = await db.select().from(releaseCases).where(eq(releaseCases.id, Number(id))).limit(1);
  if (!kase) notFound();

  const def = RELEASE_TYPES[kase.releaseType as ReleaseTypeKey];
  const d = kase.data;
  const isEntity = d.partyType === "entity";
  const cad = (await db.select().from(users).where(eq(users.role, "cad")).limit(1))[0];
  const today = fmtDate(kase.letterStatus === "pending" ? new Date() : kase.updatedAt ?? new Date());
  const ref = `CIB/REL/${(d.blacklistNumber ?? "").replace("BLK-", "")}`;

  return (
    <div className="-mx-8 -my-8 min-h-screen bg-paper2/60">
      <PrintBar label={def.short} />
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="print-page border border-line bg-white px-12 py-12 shadow-xl shadow-ink/10 sm:px-16">
          {/* letterhead */}
          <div className="flex items-start justify-between border-b-2 border-ink pb-6">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-md bg-pinedeep">
                <ShieldCheck className="size-6 text-white" />
              </div>
              <div>
                <div className="font-display text-[19px] font-bold leading-none tracking-tight text-ink">DigiHost Bank Ltd.</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-ink3">Credit Administration Department / CIC</div>
              </div>
            </div>
            <div className="text-right font-mono text-[11px] leading-relaxed text-ink2">
              <div>Ref: {ref}</div>
              <div>Date: {today}</div>
            </div>
          </div>

          <div className="mt-8 text-[12.5px] leading-relaxed text-ink">
            <div className="font-medium">The Manager</div>
            <div>Credit Information Bureau (CIB)</div>
            <div>Central Registry Desk</div>
          </div>

          <div className="mt-6 border-y border-line py-3">
            <span className="font-display text-[14px] font-semibold text-ink">
              Subject: Release of {isEntity ? "Entity" : "Individual"} Blacklisting — {d.partyName}{" "}
              <span className="font-mono text-[12px] font-normal text-ink2">({d.blacklistNumber})</span>
            </span>
          </div>

          <div className="mt-6 space-y-4 text-[12.5px] leading-[1.75] text-ink">
            <p>Dear Sir/Madam,</p>
            {isEntity ? (
              <p>
                With reference to the blacklisting of <strong>{d.partyName}</strong> (CIF: {d.cifId}), an entity
                registered with this bank, recorded under blacklist number <strong>{d.blacklistNumber}</strong>, we hereby
                confirm that the grounds giving rise to the blacklisting have been resolved in accordance with the
                applicable recovery and regularization procedures. The competent authorities of the bank have approved the
                release under <strong>{def.label}</strong> ({def.code}).
              </p>
            ) : (
              <p>
                With reference to the blacklisting of <strong>{d.partyName}</strong> (CIF: {d.cifId}), recorded under
                blacklist number <strong>{d.blacklistNumber}</strong>, we hereby confirm that the obligations giving rise
                to the blacklisting have been duly settled. The competent authorities of the bank have approved the release
                under <strong>{def.label}</strong> ({def.code}).
              </p>
            )}
            {d.basis && <p>{d.basis}</p>}
            <p>
              You are therefore requested to update your records and release the above-referenced {isEntity ? "entity" : "individual"}{" "}
              from the blacklist with immediate effect.
            </p>
          </div>

          {/* particulars */}
          <table className="mt-6 w-full border-collapse text-[11.5px]">
            <tbody>
              {[
                ["Release type", def.label],
                ["Party type", isEntity ? "Entity / Company" : "Individual"],
                ["CIF ID", d.cifId],
                ["Blacklist number", d.blacklistNumber],
                ["Account number", d.accountNumber || "—"],
                ...(d.chequeAmount ? [["Cheque amount", fmtMoney(d.chequeAmount)]] : []),
                ...(d.chequeNumber ? [["Cheque number", d.chequeNumber]] : []),
                ...(d.payeeName ? [["Payee / beneficiary", d.payeeName]] : []),
                ...(d.loanAccountNo ? [["Loan account", d.loanAccountNo]] : []),
                ...(d.settlementRef ? [["LOS settlement reference", d.settlementRef]] : []),
                ...(d.guarantorName ? [["Guarantor released", `${d.guarantorName} (borrower remains blacklisted)`]] : []),
                ...(d.periodMonths ? [["Temporary period", "Six (6) months — EMI payment plan"]] : []),
                ["Freeze reason code(s)", d.freezeCodes || "—"],
              ].map(([k, v]) => (
                <tr key={k as string}>
                  <td className="w-52 border border-line bg-paper2/50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink2">{k}</td>
                  <td className="border border-line px-3 py-2 text-ink">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-10 flex items-end justify-between">
            <div className="text-[11.5px] leading-relaxed text-ink2">
              <p>Thank you for your cooperation.</p>
              <p className="mt-1">Yours faithfully,</p>
            </div>
            <div className="text-center">
              <div className="font-script text-[34px] leading-none text-pinedeep">{cad?.name ?? "CAD/CIC Officer"}</div>
              <div className="mt-1 border-t border-ink/40 px-6 pt-2 text-[11px] text-ink">
                <div className="font-semibold">{cad?.name ?? "CAD/CIC Officer"}</div>
                <div className="mt-0.5 text-ink2">Authorized Signatory — Credit Administration / CIC</div>
                <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-pine">
                  ● Digitally signed · uploaded in the CIB Release Letter
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-line pt-4 text-[9.5px] leading-relaxed text-ink3">
            This letter was generated by DigiHost as part of the system-driven blacklisting release process
            ({kase.reference}). Digital signature is uploaded in the CIB Release Letter in place of a printed and scanned
            copy. Verify against case reference before reliance.
          </div>
        </div>
      </div>
    </div>
  );
}

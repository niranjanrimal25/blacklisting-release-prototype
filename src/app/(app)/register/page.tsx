import Link from "next/link";
import { desc } from "drizzle-orm";
import { ArrowUpRight, Search, Snowflake, FilePlus2 } from "lucide-react";
import { db } from "@/db";
import { blacklistRecords, releaseCases } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { fmtDate, unfreezeEligibility } from "@/lib/workflow";
import { Card, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

function recordStatusMeta(status: string) {
  switch (status) {
    case "active": return { label: "Active — blacklisted", cls: "tone-red" };
    case "released": return { label: "Released", cls: "tone-green" };
    case "partially_released": return { label: "Partially released (guarantor)", cls: "tone-amber" };
    case "temporary_released": return { label: "Temporary release — 6 months", cls: "tone-cyan" };
    default: return { label: status, cls: "tone-neutral" };
  }
}

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { q } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();

  const [records, cases] = await Promise.all([
    db.select().from(blacklistRecords).orderBy(desc(blacklistRecords.blacklistedAt)),
    db.select().from(releaseCases),
  ]);

  const filtered = query
    ? records.filter(
        (r) =>
          r.partyName.toLowerCase().includes(query) ||
          r.blacklistNumber.toLowerCase().includes(query) ||
          r.cifId.toLowerCase().includes(query) ||
          (r.caseNumber ?? "").toLowerCase().includes(query) ||
          (r.accountNumber ?? "").toLowerCase().includes(query)
      )
    : records;

  const openCaseFor = (recordId: number) =>
    cases.find((c) => c.blacklistRecordId === recordId && !["RELEASED", "REJECTED", "CANCELLED"].includes(c.status));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-gold">Blacklist register</div>
          <h1 className="mt-2 font-display text-[34px] font-semibold tracking-tight text-ink">Blacklisted parties</h1>
          <p className="mt-1 max-w-2xl text-[13.5px] text-ink2">
            Cases blacklisted through DigiHost or recorded manually. Retrieval keys — Case Number, CIF ID or Blacklist
            Number — drive auto-population when a release case starts.
          </p>
        </div>
        {user.role.startsWith("initiator") && (
          <Link href="/cases/new" className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2.5 text-[13px] font-medium text-paper transition-colors hover:bg-pinedeep">
            <FilePlus2 className="size-4" /> Start release case
          </Link>
        )}
      </div>

      <form className="mt-7 flex max-w-md items-center gap-2" action="/register" method="get">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink3" />
          <input name="q" defaultValue={q} placeholder="Search party, case no., CIF, blacklist no…" className="field-input pl-9" />
        </div>
        <button className="rounded-md border border-line bg-white px-4 py-2 text-[13px] font-medium text-ink hover:border-ink/40">Search</button>
      </form>

      <Card className="mt-5 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No records match" sub="Try a different identifier or party name." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b border-line bg-paper2/50">
                  {["Party", "Identifiers", "Category", "Freeze", "Blacklisted", "Status", ""].map((h) => (
                    <th key={h} className="px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {filtered.map((r) => {
                  const sm = recordStatusMeta(r.status);
                  const elig = unfreezeEligibility(r.freezeCodes ?? []);
                  const openCase = openCaseFor(r.id);
                  return (
                    <tr key={r.id} className="transition-colors hover:bg-paper2/30">
                      <td className="px-5 py-3.5">
                        <div className="text-[13.5px] font-medium text-ink">{r.partyName}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink2">
                          <span className="rounded border border-line bg-paper2 px-1.5 py-px font-mono text-[9.5px] uppercase tracking-wider">{r.partyType}</span>
                          <span className={r.source === "digihost" ? "text-pine" : "text-gold"}>{r.source === "digihost" ? "Via DigiHost" : "Manual register"}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-mono text-[11.5px] text-ink">{r.blacklistNumber}</div>
                        <div className="font-mono text-[10.5px] text-ink3">{r.caseNumber ?? "no DigiHost case"} · {r.cifId}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`rounded-full border px-2.5 py-1 text-[10.5px] font-medium ${r.category === "cheque" ? "tone-cyan" : "tone-violet"}`}>
                          {r.category === "cheque" ? "Cheque" : "NPA"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5" title={elig.reason}>
                        <div className="flex items-center gap-1.5">
                          <Snowflake className={`size-3.5 ${r.accountStatus === "frozen" ? "text-blue-700" : "text-ink3"}`} />
                          <span className="font-mono text-[11px] text-ink">{(r.freezeCodes ?? []).join(" + ")}</span>
                        </div>
                        <div className="mt-0.5 text-[10px] text-ink3">
                          {r.accountStatus === "unfrozen" ? "Unfrozen" : elig.eligible ? "Auto-unfreeze eligible" : "Manual unfreeze control"}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-[12px] text-ink2">{fmtDate(r.blacklistedAt)}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-medium ${sm.cls}`}>{sm.label}</span>
                        {r.temporaryUntil && <div className="mt-1 font-mono text-[10px] text-ink3">until {fmtDate(r.temporaryUntil)}</div>}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {openCase ? (
                          <Link href={`/cases/${openCase.id}`} className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-pine hover:underline">
                            {openCase.reference} <ArrowUpRight className="size-3" />
                          </Link>
                        ) : (
                          <Link href={`/cases/new?record=${r.id}`} className="text-[11px] font-medium text-ink2 hover:text-pine hover:underline">
                            Start release →
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-ink3">
        Auto-unfreeze applies only after CAD/CIC release and only for a single freeze reason code 002 / 025 / 100.
      </p>
    </div>
  );
}

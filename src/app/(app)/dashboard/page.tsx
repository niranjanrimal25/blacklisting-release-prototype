import Link from "next/link";
import { desc } from "@/db";
import {
  ArrowRight,
  ArrowUpRight,
  Clock3,
  FilePlus2,
  Inbox,
  Layers,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { db, ensureReady } from "@/db";
import { blacklistRecords, caseEvents, releaseCases } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";
import {
  RELEASE_TYPES,
  STATUS_META,
  fmtDate,
  unfreezeEligibility,
  type ReleaseTypeKey,
  type StatusKey,
} from "@/lib/workflow";
import { Card, EmptyState, StatusPill, UserChip } from "@/components/ui";
import { AdminActions } from "@/components/admin-actions";

export const dynamic = "force-dynamic";

const NEEDS_ACTION: Record<string, string[]> = {
  initiator_branch: ["RETURNED", "QUERY", "LETTER_PENDING", "DRAFT", "ON_HOLD"],
  initiator_npa: ["RETURNED", "QUERY", "DRAFT", "ON_HOLD"],
  initiator_csd: ["RETURNED", "QUERY", "LETTER_PENDING", "DRAFT", "ON_HOLD"],
  reviewer_oi: ["PENDING_REVIEW"],
  reviewer_bm: ["PENDING_REVIEW"],
  brops: ["PENDING_REVIEW"],
  cad: ["PENDING_CAD", "CIB_REPORTED", "CIB_RETURNED", "LETTER_PENDING"],
};

function myQueue(cases: (typeof releaseCases.$inferSelect)[], userId: string, role: string) {
  if (role.startsWith("initiator")) return cases.filter((c) => c.initiatorId === userId);
  if (role === "cad")
    return cases.filter(
      (c) =>
        ["PENDING_CAD", "CIB_REPORTED", "CIB_RETURNED"].includes(c.status) ||
        (c.status === "LETTER_PENDING" && RELEASE_TYPES[c.releaseType as ReleaseTypeKey].letterOwner === "cad")
    );
  // reviewers + brops
  return cases.filter(
    (c) =>
      (c.status === "PENDING_REVIEW" && (c.reviewerId === userId || (role === "brops" && c.routedToPool && !c.reviewerId)))
  );
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  await ensureReady();

  const [cases, records, events] = await Promise.all([
    db.select().from(releaseCases).orderBy(desc(releaseCases.updatedAt)),
    db.select().from(blacklistRecords).orderBy(desc(blacklistRecords.blacklistedAt)),
    db.select().from(caseEvents).orderBy(desc(caseEvents.createdAt)).limit(9),
  ]);

  const queue = myQueue(cases, user.id, user.role);
  const needs = NEEDS_ACTION[user.role] ?? [];
  const actionNeeded = queue.filter((c) => needs.includes(c.status));
  const activeCases = cases.filter((c) => !["RELEASED", "REJECTED", "CANCELLED"].includes(c.status));
  const released = cases.filter((c) => c.status === "RELEASED");
  const activeBlacklist = records.filter((r) => ["active", "partially_released"].includes(r.status));
  const poolCount = cases.filter((c) => c.status === "PENDING_REVIEW" && c.routedToPool && !c.reviewerId).length;

  const stats: { label: string; value: number; sub: string; icon: typeof Clock3; accent?: boolean }[] = [
    { label: "Awaiting your action", value: actionNeeded.length, sub: "Across your operating queue", icon: Clock3, accent: true },
    { label: user.role === "brops" ? "Cases in BROPs pool" : "Active release cases", value: user.role === "brops" ? poolCount : activeCases.length, sub: user.role === "brops" ? "Unclaimed, pending claim" : "End-to-end, in workflow", icon: user.role === "brops" ? Inbox : ShieldCheck },
    { label: "Active blacklist entries", value: activeBlacklist.length, sub: "Cheque & NPA register", icon: Layers },
    { label: "Released via system", value: released.length, sub: "CAD/CIC final releases", icon: Sparkles },
  ];

  const caseName = (id: number | null) => cases.find((c) => c.id === id)?.reference ?? "";

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-gold">Operational work queue</div>
          <h1 className="mt-2 font-display text-[34px] font-semibold leading-tight tracking-tight text-ink">
            Good to see you, {user.name.split(" ")[0]}.
          </h1>
          <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-ink2">
            {user.title} · {user.unit}. Cases move through initiation, review, the release-letter stage and CAD/CIC
            validation — with routing, notifications and status tracking handled in-system.
          </p>
        </div>
        {user.role.startsWith("initiator") && (
          <Link
            href="/cases/new"
            className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2.5 text-[13px] font-medium text-paper transition-colors hover:bg-pinedeep"
          >
            <FilePlus2 className="size-4" /> Start blacklisting release
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`group rounded-xl border p-4 transition-shadow hover:shadow-md hover:shadow-ink/5 ${
              s.accent ? "border-pine/25 bg-pinedeep text-white" : "border-line bg-card"
            }`}
          >
            <div className="flex items-center justify-between">
              <s.icon className={`size-4 ${s.accent ? "text-goldsoft" : "text-ink3"}`} />
              {s.accent && s.value > 0 && <span className="size-2 animate-pulse rounded-full bg-gold" />}
            </div>
            <div className={`mt-4 font-display text-4xl font-semibold tracking-tight ${s.accent ? "text-white" : "text-ink"}`}>
              {s.value}
            </div>
            <div className={`mt-1 text-[12px] font-medium ${s.accent ? "text-white/85" : "text-ink"}`}>{s.label}</div>
            <div className={`text-[11px] ${s.accent ? "text-white/50" : "text-ink3"}`}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Queue */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Your queue</h2>
              <p className="text-[12px] text-ink2">
                {user.role.startsWith("initiator") && "Cases you initiated — act on returns, queries and the letter stage."}
                {(user.role === "reviewer_oi" || user.role === "reviewer_bm") && "Cases assigned to you for review."}
                {user.role === "brops" && "Cases claimed by you, plus the unclaimed BROPs pool."}
                {user.role === "cad" && "Cases awaiting CAD/CIC letters and final validation."}
              </p>
            </div>
            {user.role === "brops" && poolCount > 0 && (
              <Link href="/pool" className="inline-flex items-center gap-1.5 text-[12px] font-medium text-pine hover:underline">
                Open pool <ArrowUpRight className="size-3.5" />
              </Link>
            )}
          </div>
          {queue.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<Inbox className="size-5" />}
                title="Nothing in your queue"
                sub="When cases route to your role, they appear here with full status tracking — no email required."
              />
            </div>
          ) : (
            <ul className="divide-y divide-line/70">
              {queue.slice(0, 10).map((c) => {
                const def = RELEASE_TYPES[c.releaseType as ReleaseTypeKey];
                const hot = needs.includes(c.status);
                return (
                  <li key={c.id}>
                    <Link href={`/cases/${c.id}`} className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-paper2/40">
                      <div className="w-28 shrink-0">
                        <div className="font-mono text-[12px] font-medium text-ink">{c.reference}</div>
                        <div className="text-[10.5px] text-ink3">{fmtDate(c.updatedAt)}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[13.5px] font-medium text-ink">{c.data.partyName}</span>
                          {hot && <span className="size-1.5 shrink-0 rounded-full bg-gold" />}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-ink2">
                          <span className="rounded border border-line bg-paper2 px-1.5 py-px font-mono text-[9.5px] uppercase tracking-wider">{def.short}</span>
                          <span className="truncate font-mono text-[10.5px]">{c.data.blacklistNumber}</span>
                        </div>
                      </div>
                      <StatusPill status={c.status} size="sm" />
                      <ArrowRight className="size-4 shrink-0 text-ink3 transition-transform group-hover:translate-x-1 group-hover:text-pine" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Activity rail */}
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="border-b border-line px-5 py-4">
              <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Live routing feed</h2>
              <p className="text-[12px] text-ink2">System-driven movement replacing email traffic.</p>
            </div>
            <ul className="divide-y divide-line/60 px-5">
              {events.map((e) => (
                <li key={e.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-pine">{e.action.replace(/_/g, " ")}</span>
                    <span className="font-mono text-[10px] text-ink3">
                      {new Date(e.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    </span>
                  </div>
                  <Link href={`/cases/${e.caseId}`} className="mt-1 block font-mono text-[11px] font-medium text-ink hover:text-pine">
                    {caseName(e.caseId)}
                  </Link>
                  <div className="mt-0.5 text-[11.5px] leading-snug text-ink2">
                    <UserChip name={e.actorName} /> {e.remarks ? <span className="text-ink3">— {e.remarks}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-line px-5 py-4">
              <h2 className="font-display text-lg font-semibold tracking-tight text-ink">The controlled loop</h2>
              <p className="text-[12px] text-ink2">Standard sequence for every release type.</p>
            </div>
            <ol className="px-5 py-4">
              {["Start & identify", "Auto-populate / manual entry", "Select type & reviewer", "Complete checklist", "Review · Approve / Return / Query", "Letter stage", "CAD/CIC validation", "Release & eligible unfreeze"].map((s, i) => (
                <li key={s} className="flex items-center gap-3 py-1.5">
                  <span className={`flex size-5 items-center justify-center rounded-full border font-mono text-[9.5px] ${i < 8 ? "border-line bg-white text-ink2" : ""}`}>{i + 1}</span>
                  <span className="text-[12.5px] text-ink2">{s}</span>
                </li>
              ))}
            </ol>
          </Card>

          <AdminActions myCount={cases.filter((c:any)=>c.initiatorId===user.id).length} totalCount={cases.length} />
        </div>
      </div>
    </div>
  );
}

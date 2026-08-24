import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { ArrowRight, HandMetal, Inbox } from "lucide-react";
import { db } from "@/db";
import { releaseCases, users } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { RELEASE_TYPES, fmtDateTime, type ReleaseTypeKey } from "@/lib/workflow";
import { Card, EmptyState, StatusPill } from "@/components/ui";
import { ClaimButton } from "@/components/pool-actions";

export const dynamic = "force-dynamic";

export default async function PoolPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const pool = await db
    .select()
    .from(releaseCases)
    .where(and(eq(releaseCases.status, "PENDING_REVIEW"), eq(releaseCases.routedToPool, true), isNull(releaseCases.reviewerId)))
    .orderBy(desc(releaseCases.submittedAt));

  const mine = await db
    .select()
    .from(releaseCases)
    .where(and(eq(releaseCases.status, "PENDING_REVIEW"), eq(releaseCases.reviewerId, user.id)))
    .orderBy(desc(releaseCases.updatedAt));

  const initiators = await db.select().from(users);
  const nameOf = (id: string) => initiators.find((u) => u.id === id)?.name ?? id;

  const isBrops = user.role === "brops";

  return (
    <div className="mx-auto max-w-6xl">
      <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-gold">Branch Operations Control</div>
      <h1 className="mt-2 font-display text-[34px] font-semibold tracking-tight text-ink">BROPs pool</h1>
      <p className="mt-1 max-w-2xl text-[13.5px] text-ink2">
        Cheque-release cases enter the pool unassigned. A BROPs user claims a case and the system assigns it
        to that user for review — Approve, Forward, Return or Query with mandatory remarks.
      </p>

      <Card className="mt-7 overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Unclaimed cases</h2>
          <p className="text-[12px] text-ink2">First come, first served — claiming assigns the case to you.</p>
        </div>
        {pool.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={<Inbox className="size-5" />} title="Pool is empty" sub="New cheque-release submissions routed to BROPs will appear here." />
          </div>
        ) : (
          <ul className="divide-y divide-line/70">
            {pool.map((c) => {
              const def = RELEASE_TYPES[c.releaseType as ReleaseTypeKey];
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="w-32 shrink-0">
                    <div className="font-mono text-[12.5px] font-medium text-ink">{c.reference}</div>
                    <div className="mt-0.5 text-[10.5px] text-ink3">submitted {fmtDateTime(c.submittedAt)}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium text-ink">{c.data.partyName}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-ink2">
                      <span className="rounded border border-line bg-paper2 px-1.5 py-px font-mono text-[9.5px] uppercase tracking-wider">{def.short}</span>
                      <span className="font-mono text-[10.5px]">{c.data.blacklistNumber}</span>
                      <span>· by {nameOf(c.initiatorId)}</span>
                    </div>
                  </div>
                  <StatusPill status={c.status} size="sm" />
                  <div className="flex items-center gap-2">
                    <Link href={`/cases/${c.id}`} className="rounded-md border border-line bg-white px-3 py-2 text-[12px] font-medium text-ink hover:border-ink/40">
                      View case
                    </Link>
                    {isBrops && <ClaimButton caseId={c.id} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {mine.length > 0 && (
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Assigned to you</h2>
            <p className="text-[12px] text-ink2">Cases you claimed — complete the review decision.</p>
          </div>
          <ul className="divide-y divide-line/70">
            {mine.map((c) => {
              const def = RELEASE_TYPES[c.releaseType as ReleaseTypeKey];
              return (
                <li key={c.id}>
                  <Link href={`/cases/${c.id}`} className="group flex items-center gap-4 px-5 py-3.5 hover:bg-paper2/40">
                    <span className="font-mono text-[12px] font-medium text-ink w-32">{c.reference}</span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">{c.data.partyName}</span>
                    <span className="rounded border border-line bg-paper2 px-1.5 py-px font-mono text-[9.5px] uppercase tracking-wider">{def.short}</span>
                    <span className="flex items-center gap-1 text-[12px] font-medium text-pine"><HandMetal className="size-3.5" /> claimed</span>
                    <ArrowRight className="size-4 text-ink3 transition-transform group-hover:translate-x-1" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

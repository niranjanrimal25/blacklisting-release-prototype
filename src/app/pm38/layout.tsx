import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { and, desc, eq, isNull } from "@/db";
import { db, ensureReady } from "@/db";
import { notifications, releaseCases } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { Pm38Header, Pm38Sidebar } from "@/components/pm38-shell";

export const dynamic = "force-dynamic";

export default async function Pm38Layout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  await ensureReady();

  const [notifs, pool, allCases] = await Promise.all([
    db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(20),
    db.select().from(releaseCases).where(and(eq(releaseCases.status, "PENDING_REVIEW"), eq(releaseCases.routedToPool, true), isNull(releaseCases.reviewerId))),
    db.select().from(releaseCases),
  ]);

  const myDraftCount = allCases.filter((c: any) => c.initiatorId === user.id && ["DRAFT","ON_HOLD","RETURNED","QUERY","LETTER_PENDING"].includes(c.status)).length;
  const inboxCount = allCases.filter((c: any) => {
    if (c.status === "PENDING_REVIEW" && c.reviewerId === user.id) return true;
    if (["PENDING_CAD","CIB_REPORTED","CIB_RETURNED"].includes(c.status) && user.role === "cad") return true;
    return false;
  }).length;

  return (
    <div className="min-h-screen bg-[#f4f6f7] flex flex-col">
      <Pm38Header user={user} />
      <div className="flex flex-1">
        <Pm38Sidebar user={user} poolCount={pool.length} myDraftCount={myDraftCount} inboxCount={inboxCount} />
        <div className="flex-1 p-4 overflow-auto">
          <div className="mb-2 flex items-center gap-2 text-[11px]">
            <span className="bg-[#2c3e50] text-white px-2 py-1 rounded font-mono">PM 3.8 Prototype Mode</span>
            <span className="text-[#7f8c8d]">This mimics ProcessMaker 3.8 classic UI but runs on Next.js + .memory-data.json — no DB config</span>
            <span className="ml-auto text-[#2980b9]">Cases: {allCases.length} | Pool: {pool.length} | Draft: {myDraftCount}</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

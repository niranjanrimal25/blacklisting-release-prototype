import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications, releaseCases } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { NotifBell, Sidebar } from "@/components/shell";
import { fmtDate } from "@/lib/workflow";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [notifs, pool] = await Promise.all([
    db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(20),
    db
      .select({ id: releaseCases.id })
      .from(releaseCases)
      .where(and(eq(releaseCases.status, "PENDING_REVIEW"), eq(releaseCases.routedToPool, true), isNull(releaseCases.reviewerId))),
  ]);

  const today = fmtDate(new Date());

  return (
    <div className="min-h-screen">
      <Sidebar user={user} poolCount={pool.length} />
      <div className="ml-64">
        <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/85 px-8 py-3.5 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink3">DigiHost / Blacklisting Release Process</span>
            <span className="hidden h-4 w-px bg-line sm:block" />
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.24em] text-ink3 sm:block">{today}</span>
          </div>
          <NotifBell userId={user.id} items={notifs} />
        </header>
        <main className="paper-grain min-h-[calc(100vh-57px)] px-8 py-8">{children}</main>
      </div>
    </div>
  );
}

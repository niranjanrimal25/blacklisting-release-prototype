import { redirect } from "next/navigation";
import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { blacklistRecords, users } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { NewCaseWizard } from "@/components/wizard";

export const dynamic = "force-dynamic";

export default async function NewCasePage({ searchParams }: { searchParams: Promise<{ record?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.role.startsWith("initiator")) redirect("/dashboard");

  const { record } = await searchParams;

  const reviewers = await db
    .select({ id: users.id, name: users.name, role: users.role, unit: users.unit, title: users.title })
    .from(users)
    .where(or(eq(users.role, "reviewer_oi"), eq(users.role, "reviewer_bm"), eq(users.role, "brops")));

  let prefetched = null;
  if (record) {
    const [r] = await db.select().from(blacklistRecords).where(eq(blacklistRecords.id, Number(record))).limit(1);
    prefetched = r ?? null;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-gold">Step 1–8 · Common flow</div>
      <h1 className="mt-2 font-display text-[34px] font-semibold tracking-tight text-ink">Start a blacklisting release</h1>
      <p className="mt-1 max-w-2xl text-[13.5px] text-ink2">
        Identify the blacklisted case, verify auto-populated data or enter it manually, choose one of the six release
        types, complete the type-specific details and select the reviewing authority per your reporting structure.
      </p>
      <NewCaseWizard reviewers={reviewers} prefetchedRecord={prefetched} />
    </div>
  );
}

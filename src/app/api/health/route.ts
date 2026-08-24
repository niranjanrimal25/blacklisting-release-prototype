import { db, ensureReady } from "@/db";
import { sql } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureReady();
    await db.execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[health] error", e);
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { eq } from "@/db";
import { readFile } from "fs/promises";
import { db, ensureReady } from "@/db";
import { caseDocuments } from "@/db/schema";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  await ensureReady();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const [doc] = await db
    .select()
    .from(caseDocuments)
    .where(eq(caseDocuments.id, Number(id)))
    .limit(1);

  if (!doc || !doc.filePath)
    return NextResponse.json({ ok: false, error: "File not available (carried-forward reference only)." }, { status: 404 });

  try {
    const buf = await readFile(doc.filePath);
    const inline = (doc.mimeType ?? "").startsWith("image/") || doc.mimeType === "application/pdf";
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": doc.mimeType ?? "application/octet-stream",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${(doc.fileName ?? "document").replace(/"/g, "")}"`,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Stored file could not be read." }, { status: 404 });
  }
}

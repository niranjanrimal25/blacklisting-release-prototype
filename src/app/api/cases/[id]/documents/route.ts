import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { releaseCases } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { logEvent, saveDocument } from "@/lib/engine";
import { RELEASE_TYPES, type ReleaseTypeKey } from "@/lib/workflow";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Session expired — sign in again." }, { status: 401 });

  const { id } = await ctx.params;
  const caseId = Number(id);
  const [kase] = await db.select().from(releaseCases).where(eq(releaseCases.id, caseId)).limit(1);
  if (!kase) return NextResponse.json({ ok: false, error: "Case not found." }, { status: 404 });

  const def = RELEASE_TYPES[kase.releaseType as ReleaseTypeKey];
  const form = await req.formData();
  const requirementKey = (form.get("requirementKey") as string) || null;
  const label = ((form.get("label") as string) || "Document").trim();
  const file = form.get("file") as File | null;

  // Who may upload what, when
  const isInitiator = user.id === kase.initiatorId;
  const editableStages = ["DRAFT", "ON_HOLD", "RETURNED", "QUERY"];
  const isSignedLetter = requirementKey === "signed_letter";

  if (isSignedLetter) {
    const ownerOk = def.letterOwner === "initiator" ? isInitiator : user.role === "cad";
    if (kase.status !== "LETTER_PENDING" || !ownerOk)
      return NextResponse.json({ ok: false, error: "The signed release letter can only be uploaded at the letter stage by the responsible role." }, { status: 400 });
  } else {
    if (!(isInitiator && editableStages.includes(kase.status)) && user.role !== "cad")
      return NextResponse.json({ ok: false, error: "Documents can be uploaded by the initiator while the case is in Draft/Returned/Query, or by CAD/CIC." }, { status: 400 });
  }

  if (!file || file.size === 0)
    return NextResponse.json({ ok: false, error: "Choose a file to upload." }, { status: 400 });

  await saveDocument({
    caseId,
    requirementKey,
    label: isSignedLetter ? "CIB Release Letter — digitally signed" : label,
    file,
    source: "uploaded",
    uploadedBy: user.id,
  });

  if (isSignedLetter) {
    await logEvent({
      caseId,
      actor: { id: user.id, name: user.name, role: user.role },
      action: "SIGNED_LETTER_UPLOADED",
      remarks: `Signed/digitally-signed release letter uploaded by ${user.name}.`,
    });
  }

  return NextResponse.json({ ok: true });
}

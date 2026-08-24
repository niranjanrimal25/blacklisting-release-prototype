import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { performCaseAction } from "@/lib/engine";
import { ensureReady } from "@/db";
import type { ActionKey } from "@/lib/workflow";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    await ensureReady();
    if (!user) return NextResponse.json({ ok: false, error: "Session expired — sign in again." }, { status: 401 });

    const { id } = await ctx.params;
    const caseId = Number(id);
    const form = await req.formData();
    const action = (form.get("action") as ActionKey) ?? null;
    if (!action) return NextResponse.json({ ok: false, error: "Missing action." }, { status: 400 });

    const attachment = form.get("attachment");
    const file = attachment instanceof File && attachment.size > 0 ? attachment : null;

    const res = await performCaseAction(user, caseId, action, {
      remarks: (form.get("remarks") as string) ?? "",
      forwardTo: (form.get("forwardTo") as string) ?? "",
      requestNumber: (form.get("requestNumber") as string) ?? "",
      attachment: file,
    });

    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (e: any) {
    console.error("[actions API] unhandled", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "@/db";
import { db, ensureReady } from "@/db";
import { notifications } from "@/db/schema";
import {
  clearSession,
  getSessionUser,
  setSessionUser,
  type SessionUser,
} from "@/lib/session";
import {
  createCase,
  lookupBlacklist,
  performCaseAction,
  type NewCasePayload,
} from "@/lib/engine";
import type { ActionKey } from "@/lib/workflow";

export async function loginAs(userId: string) {
  await setSessionUser(userId);
  redirect("/dashboard");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}

export async function lookupAction(identifier: string) {
  const rec = await lookupBlacklist(identifier);
  if (!rec) return { found: false as const };
  return { found: true as const, record: rec };
}

export async function createCaseAction(payload: NewCasePayload) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Session expired — sign in again." };
  if (!user.role.startsWith("initiator"))
    return { ok: false as const, error: "Only initiator roles (Branch, NPA, CSD, other configured users) can initiate a release case." };
  const res = await createCase(user, payload);
  if (res.ok) revalidatePath("/dashboard");
  return res;
}

export async function simpleCaseAction(caseId: number, action: ActionKey) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Session expired — sign in again." };
  const res = await performCaseAction(user, caseId, action, {});
  if (res.ok) revalidatePath(`/cases/${caseId}`);
  if (res.ok) revalidatePath("/dashboard");
  return res;
}

export async function markNotificationsRead() {
  const user: SessionUser | null = await getSessionUser();
  if (!user) return;
  await ensureReady();
  await db.update(notifications).set({ read: true }).where(eq(notifications.userId, user.id));
  revalidatePath("/dashboard");
}

export async function clearMyCases() {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Session expired" };
  await ensureReady();
  const { releaseCases, caseDocuments, caseEvents, notifications } = await import("@/db/schema");
  const { eq } = await import("@/db");
  // Find my cases
  const myCases = await db.select().from(releaseCases).where(eq(releaseCases.initiatorId, user.id));
  const ids = myCases.map((c: any) => c.id);
  for (const id of ids) {
    await db.delete(caseDocuments).where(eq(caseDocuments.caseId, id));
    await db.delete(caseEvents).where(eq(caseEvents.caseId, id));
    await db.delete(notifications).where(eq(notifications.caseId, id));
  }
  await db.delete(releaseCases).where(eq(releaseCases.initiatorId, user.id));
  revalidatePath("/dashboard");
  revalidatePath("/register");
  revalidatePath("/pool");
  return { ok: true as const, count: ids.length };
}

export async function clearAllCases() {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Session expired" };
  // Only allow initiators or cad to clear all for demo
  await ensureReady();
  const { releaseCases, caseDocuments, caseEvents, notifications } = await import("@/db/schema");
  await db.delete(caseDocuments);
  await db.delete(caseEvents);
  await db.delete(notifications);
  await db.delete(releaseCases);
  // Also clear file to force reseed on next request if you want fresh demo
  try {
    const fs = await import("fs");
    const path = await import("path");
    const file = path.join(process.cwd(), ".memory-data.json");
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {}
  revalidatePath("/dashboard");
  revalidatePath("/register");
  revalidatePath("/pool");
  return { ok: true as const };
}

export async function resetDemoData() {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Session expired" };
  await ensureReady();
  const { releaseCases, caseDocuments, caseEvents, notifications, blacklistRecords, users } = await import("@/db/schema");
  await db.delete(caseDocuments);
  await db.delete(caseEvents);
  await db.delete(notifications);
  await db.delete(releaseCases);
  await db.delete(blacklistRecords);
  await db.delete(users);
  try {
    const fs = await import("fs");
    const path = await import("path");
    const file = path.join(process.cwd(), ".memory-data.json");
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {}
  // Next request will auto-seed via ensureReady
  revalidatePath("/dashboard");
  revalidatePath("/register");
  revalidatePath("/pool");
  return { ok: true as const };
}

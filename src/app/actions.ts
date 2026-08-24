"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
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
  await db.update(notifications).set({ read: true }).where(eq(notifications.userId, user.id));
  revalidatePath("/dashboard");
}

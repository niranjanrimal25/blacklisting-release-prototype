import { cookies } from "next/headers";
import { db, ensureReady } from "@/db";
import { users } from "@/db/schema";
import { eq } from "@/db";

export type SessionUser = {
  id: string;
  name: string;
  role: string;
  unit: string;
  title: string;
};

const COOKIE = "dh_uid";

export async function getSessionUser(): Promise<SessionUser | null> {
  await ensureReady();
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (!id) return null;
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return u ?? null;
}

export async function setSessionUser(id: string) {
  const jar = await cookies();
  jar.set(COOKIE, id, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 7 });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

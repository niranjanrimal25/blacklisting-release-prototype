import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Always first go to login page as requested
  redirect("/login");
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Bell,
  LayoutDashboard,
  FilePlus2,
  Inbox,
  Layers,
  LogOut,
  ShieldCheck,
  UserRound,
  UsersRound,
  DraftingCompass,
  Monitor,
} from "lucide-react";
import { logout, markNotificationsRead } from "@/app/actions";
import { roleLabel } from "@/lib/workflow";

type NavUser = { id: string; name: string; role: string; unit: string; title: string };
type Notif = { id: number; caseId: number | null; message: string; read: boolean; createdAt: Date };

const NAV = [
  { href: "/dashboard", label: "Work Queue", icon: LayoutDashboard },
  { href: "/cases/new", label: "New Release Case", icon: FilePlus2 },
  { href: "/pool", label: "BROPs Pool", icon: Inbox },
  { href: "/register", label: "Blacklist Register", icon: Layers },
  { href: "/designer", label: "Designer – Flow Diagram", icon: DraftingCompass },
  { href: "/pm38", label: "PM 3.8 Style (Classic)", icon: Monitor },
];

export function Sidebar({ user, poolCount }: { user: NavUser; poolCount: number }) {
  const pathname = usePathname();
  return (
    <aside className="side-grid dark-scroll fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-y-auto border-r border-white/10 bg-side">
      <div className="px-6 pt-7 pb-6">
        <Link href="/dashboard" className="group block">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-md bg-pine">
              <ShieldCheck className="size-5 text-white" />
            </div>
            <div>
              <div className="font-display text-[17px] font-semibold leading-none tracking-tight text-white">
                DigiHost
              </div>
              <div className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/45">
                Blacklist Release
              </div>
            </div>
          </div>
        </Link>
      </div>

      <div className="px-6 pb-2 font-mono text-[9.5px] uppercase tracking-[0.22em] text-white/35">
        Operations
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] transition-colors ${
                active ? "bg-white/10 text-white" : "text-white/55 hover:bg-white/5 hover:text-white/90"
              }`}
            >
              <span className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full transition-colors ${active ? "bg-gold" : "bg-transparent group-hover:bg-white/25"}`} />
              <Icon className="size-4" />
              <span className="flex-1 font-medium">{item.label}</span>
              {item.href === "/pool" && poolCount > 0 && (
                <span className="rounded-full bg-gold px-1.5 py-0.5 font-mono text-[10px] font-semibold text-side">
                  {poolCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="rounded-lg bg-white/5 p-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-full bg-pine text-[11px] font-semibold text-white">
              <UserRound className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-white">{user.name}</div>
              <div className="truncate text-[10.5px] text-white/45">{user.unit}</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 rounded-md border border-gold/40 bg-gold/10 px-2 py-1.5">
            <UsersRound className="size-3.5 text-gold" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-gold">{roleLabel(user.role)}</span>
          </div>
          <div className="mt-3 flex gap-2">
            <Link
              href="/login"
              className="flex-1 rounded-md border border-white/15 px-2 py-1.5 text-center text-[11px] font-medium text-white/70 transition-colors hover:border-white/35 hover:text-white"
            >
              Switch role
            </Link>
            <button
              onClick={() => logout()}
              title="Sign out"
              className="flex items-center justify-center rounded-md border border-white/15 px-2.5 py-1.5 text-white/70 transition-colors hover:border-white/35 hover:text-white"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function NotifBell({ userId, items }: { userId: string; items: Notif[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, start] = useTransition();
  const unread = items.filter((i) => !i.read).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex size-9 items-center justify-center rounded-md border border-line bg-white text-ink2 transition-colors hover:border-ink/40 hover:text-ink"
        aria-label="Notifications"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-gold font-mono text-[9px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-[380px] overflow-hidden rounded-xl border border-line bg-card shadow-xl shadow-ink/10">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-display text-sm font-semibold text-ink">Routing notifications</span>
              {unread > 0 && (
                <button
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await markNotificationsRead();
                      router.refresh();
                    })
                  }
                  className="text-[11px] font-medium text-pine hover:underline disabled:opacity-50"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-[380px] overflow-y-auto">
              {items.length === 0 && (
                <div className="px-4 py-8 text-center text-[13px] text-ink3">No notifications — system routing replaces email traffic.</div>
              )}
              {items.map((n) => (
                <Link
                  key={n.id}
                  href={n.caseId ? `/cases/${n.caseId}` : "/dashboard"}
                  onClick={() => setOpen(false)}
                  className={`block border-b border-line/60 px-4 py-3 transition-colors last:border-0 hover:bg-paper2/50 ${!n.read ? "bg-goldsoft/30" : ""}`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${n.read ? "bg-line" : "bg-gold"}`} />
                    <div>
                      <p className="text-[12.5px] leading-snug text-ink">{n.message}</p>
                      <p className="mt-1 font-mono text-[10px] text-ink3">
                        {new Date(n.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="border-t border-line bg-paper2/60 px-4 py-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink3">
              {userId} · In-system notification feed
            </div>
          </div>
        </>
      )}
    </div>
  );
}

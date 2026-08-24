import Link from "next/link";
import { STATUS_META, PHASES, type StatusKey } from "@/lib/workflow";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

export function StatusPill({ status, size = "md" }: { status: string; size?: "sm" | "md" }) {
  const meta = STATUS_META[status as StatusKey] ?? { label: status, tone: "neutral", phase: 0 };
  return (
    <span
      className={`tone-${meta.tone} inline-flex items-center gap-1.5 rounded-full border font-medium ${
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs"
      }`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  );
}

export function PhaseStepper({ status }: { status: string }) {
  const meta = STATUS_META[status as StatusKey] ?? { phase: 1 };
  const current = meta.phase;
  const closed = ["RELEASED", "REJECTED", "CANCELLED"].includes(status);
  return (
    <div className="flex items-center gap-0">
      {PHASES.map((p, i) => {
        const n = i + 1;
        const done = n < current || (closed && status === "RELEASED" && n === 5);
        const active = n === current && !closed;
        return (
          <div key={p} className="flex items-center">
            <div className="flex items-center gap-2">
              <span
                className={`flex size-6 items-center justify-center rounded-full border text-[11px] font-medium transition-colors ${
                  done
                    ? "border-pine bg-pine text-white"
                    : active
                      ? "border-pine bg-white text-pine"
                      : "border-line bg-white text-ink3"
                }`}
              >
                {done ? <Check className="size-3" /> : n}
              </span>
              <span className={`text-[11px] uppercase tracking-wider ${active || done ? "text-ink font-medium" : "text-ink3"}`}>
                {p}
              </span>
            </div>
            {i < PHASES.length - 1 && <div className={`mx-3 h-px w-8 lg:w-14 ${done ? "bg-pine" : "bg-line"}`} />}
          </div>
        );
      })}
    </div>
  );
}

export function SectionTitle({ index, title, sub, right }: { index?: string; title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <div className="flex items-baseline gap-3">
          {index && <span className="font-mono text-xs text-gold">{index}</span>}
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink">{title}</h2>
        </div>
        {sub && <p className="mt-1 text-[13px] leading-relaxed text-ink2">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function MetaItem({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink3">{label}</div>
      <div className={`mt-1 truncate text-sm text-ink ${mono ? "font-mono text-[13px]" : ""}`}>{value}</div>
    </div>
  );
}

export function EmptyState({ icon, title, sub, action }: { icon?: ReactNode; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-card px-6 py-12 text-center">
      {icon && <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-paper2 text-ink2">{icon}</div>}
      <div className="font-display text-base font-medium text-ink">{title}</div>
      {sub && <div className="max-w-md text-[13px] text-ink2">{sub}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function UserChip({ name, role, dark }: { name: string; role?: string; dark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${dark ? "text-white/90" : "text-ink"}`}>
      <span className={`flex size-6 items-center justify-center rounded-full text-[10px] font-semibold ${dark ? "bg-white/15 text-white" : "bg-pinedeep text-white"}`}>
        {name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
      </span>
      <span className="text-xs font-medium">{name}</span>
      {role && <span className={`text-[10px] uppercase tracking-wider ${dark ? "text-white/50" : "text-ink3"}`}>{role}</span>}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-card ${className}`}>{children}</div>;
}

export function LinkButton({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "ghost" | "gold" }) {
  const cls =
    variant === "primary"
      ? "bg-ink text-paper hover:bg-pinedeep"
      : variant === "gold"
        ? "bg-gold text-white hover:bg-[#a4742a]"
        : "border border-line bg-white text-ink hover:border-ink/40";
  return (
    <Link href={href} className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-[13px] font-medium transition-colors ${cls}`}>
      {children}
    </Link>
  );
}

export function KbdLabel({ children }: { children: ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink3">{children}</div>;
}

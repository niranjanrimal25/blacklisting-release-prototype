"use client";

import { Printer, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function PrintBar({ label }: { label: string }) {
  const router = useRouter();
  return (
    <div className="no-print sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink2 hover:text-pine"
        >
          <ArrowLeft className="size-3.5" /> Back to case
        </button>
        <div className="flex items-center gap-3">
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-ink3 sm:block">
            System-generated — DigiHost · {label}
          </span>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-1.5 text-[12px] font-medium text-paper transition-colors hover:bg-pinedeep"
          >
            <Printer className="size-3.5" /> Print / Save PDF
          </button>
        </div>
      </div>
    </div>
  );
}

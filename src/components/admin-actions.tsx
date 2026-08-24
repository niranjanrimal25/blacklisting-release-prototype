"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, RotateCcw, AlertTriangle, Loader2 } from "lucide-react";
import { clearMyCases, clearAllCases, resetDemoData } from "@/app/actions";

export function AdminActions({ myCount, totalCount }: { myCount: number; totalCount: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<any>, confirmText: string) {
    if (!window.confirm(confirmText)) return;
    setError(null);
    setMsg(null);
    start(async () => {
      const res = await action();
      if (!res.ok) {
        setError((res as any).error ?? "Failed");
      } else {
        setMsg((res as any).count !== undefined ? `Cleared ${(res as any).count} case(s) you initiated.` : "All cases cleared. Refreshing...");
        router.refresh();
        // For reset, reload after 1s to show seeded data
        if (action === resetDemoData || action === clearAllCases) {
          setTimeout(() => {
            window.location.reload();
          }, 800);
        }
      }
    });
  }

  return (
    <div className="rounded-xl border border-line bg-card overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <h3 className="font-display text-[15px] font-semibold text-ink flex items-center gap-2">
          <AlertTriangle className="size-4 text-gold" /> Demo data controls
        </h3>
        <p className="text-[11.5px] text-ink2 mt-1">Clean your initiated cases — no DB config needed. Data is in .memory-data.json</p>
      </div>
      <div className="p-4 space-y-3">
        {msg && <div className="rounded-md bg-pine/10 border border-pine/20 px-3 py-2 text-[12px] text-pinedeep">{msg}</div>}
        {error && <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">{error}</div>}

        <button
          disabled={pending || myCount === 0}
          onClick={() => run(clearMyCases, `Clear ${myCount} case(s) you initiated? This deletes their documents, events and notifications.`)}
          className="w-full flex items-center justify-between gap-2 rounded-md border border-line bg-white px-3.5 py-2.5 text-[12.5px] font-medium text-ink hover:border-ink/30 disabled:opacity-40"
        >
          <span className="flex items-center gap-2"><Trash2 className="size-4" /> Clear my cases ({myCount})</span>
          {pending && <Loader2 className="size-3.5 animate-spin" />}
        </button>

        <button
          disabled={pending || totalCount === 0}
          onClick={() => run(clearAllCases, `Clear ALL ${totalCount} release cases in system? This is for demo cleanup and deletes .memory-data.json`)}
          className="w-full flex items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-[12.5px] font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-40"
        >
          <span className="flex items-center gap-2"><Trash2 className="size-4" /> Clear ALL cases ({totalCount})</span>
          {pending && <Loader2 className="size-3.5 animate-spin" />}
        </button>

        <button
          disabled={pending}
          onClick={() => run(resetDemoData, "Reset demo data? This deletes all cases, blacklist records, users and .memory-data.json, then re-seeds 8 blacklist records + 3 cases on next request.")}
          className="w-full flex items-center justify-between gap-2 rounded-md bg-ink px-3.5 py-2.5 text-[12.5px] font-medium text-paper hover:bg-pinedeep disabled:opacity-60"
        >
          <span className="flex items-center gap-2"><RotateCcw className="size-4" /> Reset to seeded demo (8 records + 3 cases)</span>
          {pending && <Loader2 className="size-3.5 animate-spin" />}
        </button>

        <div className="pt-2 text-[10.5px] leading-relaxed text-ink3">
          <p><span className="font-semibold">No DB config needed:</span> data is file-persistent in <span className="font-mono">.memory-data.json</span>. Delete that file + restart server to reset manually.</p>
          <p className="mt-1">Manual: <span className="font-mono">rm .memory-data.json && rm -rf .next && npm run dev</span></p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Loader2,
  Paperclip,
  Zap,
} from "lucide-react";
import { ACTION_DEFS, type ActionKey } from "@/lib/workflow";

type Target = { id: string; name: string; title: string };

const KIND_STYLES: Record<string, string> = {
  primary: "bg-ink text-paper hover:bg-pinedeep",
  success: "bg-pine text-white hover:bg-pinedeep",
  danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
  neutral: "border border-line bg-white text-ink hover:border-ink/40",
};

export function ActionPanel({
  caseId,
  actions,
  forwardTargets,
  signedLetterMissing,
}: {
  caseId: number;
  actions: ActionKey[];
  forwardTargets: Target[];
  signedLetterMissing: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<ActionKey | null>(null);
  const [remarks, setRemarks] = useState("");
  const [forwardTo, setForwardTo] = useState("");
  const [requestNumber, setRequestNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  if (actions.length === 0 && !message) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-paper2/40 px-4 py-4 text-[12.5px] leading-relaxed text-ink2">
        No actions for your role at this stage. The case is with another authority; you will be notified on routing.
      </div>
    );
  }

  function reset() {
    setOpen(null); setRemarks(""); setForwardTo(""); setRequestNumber(""); setFile(null); setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function submit(action: ActionKey) {
    setError(null);
    const def = ACTION_DEFS[action];
    if (def.confirm && !window.confirm(def.confirm)) return;
    const fd = new FormData();
    fd.set("action", action);
    fd.set("remarks", remarks);
    fd.set("forwardTo", forwardTo);
    fd.set("requestNumber", requestNumber);
    if (file) fd.set("attachment", file);
    start(async () => {
      try {
        const res = await fetch(`/api/cases/${caseId}/actions`, { method: "POST", body: fd });
        let json: any;
        try {
          json = await res.json();
        } catch {
          const text = await res.text().catch(() => "");
          console.error("Action response not JSON", res.status, text.slice(0, 500));
          setError(`Server error ${res.status}: ${text.slice(0, 200) || "Action failed – check server logs"}`);
          return;
        }
        if (!json.ok) {
          setError(json.error ?? "Action failed.");
        } else {
          setMessage(json.message ?? "Done.");
          reset();
          router.refresh();
        }
      } catch (e: any) {
        setError(e?.message ?? "Network error");
      }
    });
  }

  return (
    <div>
      {message && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-pine/30 bg-pine/5 px-3 py-2.5 text-[12.5px] text-pinedeep">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {message}
        </div>
      )}
      <div className="space-y-2">
        {actions.map((key) => {
          const def = ACTION_DEFS[key];
          const isOpen = open === key;
          const needsForm = def.requires && def.requires.length > 0;
          return (
            <div key={key} className="overflow-hidden rounded-lg border border-line">
              <button
                onClick={() => {
                  if (!needsForm) return submit(key);
                  setError(null);
                  setOpen(isOpen ? null : key);
                }}
                className={`flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-[12.5px] font-medium transition-colors ${KIND_STYLES[def.kind]} ${isOpen ? "rounded-b-none" : ""}`}
              >
                <span className="flex items-center gap-2">
                  <Zap className="size-3.5 shrink-0 opacity-70" />
                  {def.label}
                </span>
                {needsForm && <ChevronDown className={`size-3.5 opacity-60 transition-transform ${isOpen ? "rotate-180" : ""}`} />}
              </button>
              {isOpen && needsForm && (
                <div className="space-y-3 border-t border-line bg-white px-3.5 py-3.5">
                  {def.hint && <p className="text-[11.5px] leading-relaxed text-ink3">{def.hint}</p>}
                  {def.requires?.includes("remarks") && (
                    <label className="block">
                      <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-ink2">
                        Remarks <span className="text-red-600">*</span>
                      </span>
                      <textarea
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        rows={3}
                        className="field-input"
                        placeholder="Mandatory remarks — reason for return / nature of query…"
                      />
                    </label>
                  )}
                  {def.requires?.includes("forwardTo") && (
                    <label className="block">
                      <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-ink2">
                        Forward to <span className="text-red-600">*</span>
                      </span>
                      <select value={forwardTo} onChange={(e) => setForwardTo(e.target.value)} className="field-input">
                        <option value="">Select authority…</option>
                        {forwardTargets.map((t) => (
                          <option key={t.id} value={t.id}>{t.name} — {t.title}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  {def.requires?.includes("requestNumber") && (
                    <label className="block">
                      <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-ink2">
                        CIB Request Number <span className="text-red-600">*</span>
                      </span>
                      <input
                        value={requestNumber}
                        onChange={(e) => setRequestNumber(e.target.value)}
                        className="field-input font-mono"
                        placeholder="e.g., CIB-REQ-2026-0441"
                      />
                    </label>
                  )}
                  {def.requires?.includes("attachment") && (
                    <label className="block cursor-pointer rounded-md border border-dashed border-line bg-paper2/40 px-3 py-3 hover:border-pine/50">
                      <span className="mb-1 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink2">
                        <Paperclip className="size-3" /> Attachment <span className="text-red-600">*</span>
                      </span>
                      <input
                        ref={fileRef}
                        type="file"
                        className="mt-1 block w-full text-[11.5px] text-ink2 file:mr-3 file:rounded file:border-0 file:bg-ink file:px-2.5 file:py-1.5 file:text-[11px] file:font-medium file:text-paper"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  )}
                  {error && (
                    <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
                      <CircleAlert className="mt-0.5 size-3.5 shrink-0" /> {error}
                    </div>
                  )}
                  <button
                    disabled={pending}
                    onClick={() => submit(key)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-ink px-3 py-2 text-[12.5px] font-medium text-paper transition-colors hover:bg-pinedeep disabled:opacity-60"
                  >
                    {pending && <Loader2 className="size-3.5 animate-spin" />}
                    Confirm — {def.label}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {open === null && error && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" /> {error}
        </div>
      )}
      {signedLetterMissing && (actions.includes("SUBMIT_TO_CAD") || actions.includes("RELEASE")) && (
        <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11.5px] leading-relaxed text-amber-900">
          The signed/digitally-signed CIB Release Letter is required before the case can advance at this stage.
        </p>
      )}
    </div>
  );
}

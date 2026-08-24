"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  CircleAlert,
  Download,
  FileText,
  Loader2,
  Paperclip,
  Plus,
  Replace,
  Signature,
  Upload,
  Archive,
} from "lucide-react";

export type DocItem = {
  id: number;
  requirementKey: string | null;
  label: string;
  fileName: string | null;
  hasFile: boolean;
  source: string;
  size: number | null;
};

export type ReqRow = {
  key: string;
  label: string;
  note?: string;
  required: boolean;
  docs: DocItem[];
};

function fmtSize(size: number | null) {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadControl({
  caseId,
  requirementKey,
  label,
  disabled,
  compact,
}: {
  caseId: number;
  requirementKey: string;
  label: string;
  disabled: boolean;
  compact?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("requirementKey", requirementKey);
    fd.set("label", label);
    fd.set("file", f);
    const res = await fetch(`/api/cases/${caseId}/documents`, { method: "POST", body: fd });
    const json = await res.json().catch(() => ({ ok: false, error: "Upload failed." }));
    setBusy(false);
    if (ref.current) ref.current.value = "";
    if (!json.ok) setError(json.error ?? "Upload failed.");
    else router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="max-w-48 text-[10.5px] leading-tight text-red-700">{error}</span>}
      <input ref={ref} type="file" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
      <button
        disabled={disabled || busy}
        onClick={() => ref.current?.click()}
        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          compact
            ? "border-line bg-white py-1.5 text-[11px] text-ink hover:border-pine/50 hover:text-pine"
            : "border-line bg-white py-2 text-[12px] text-ink hover:border-pine/50 hover:text-pine"
        }`}
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
        Upload
      </button>
    </span>
  );
}

export function DocumentsPanel({
  caseId,
  rows,
  canEdit,
}: {
  caseId: number;
  rows: ReqRow[];
  canEdit: boolean;
}) {
  return (
    <ul className="divide-y divide-line/60">
      {rows.map((r) => {
        const uploaded = r.docs.filter((d) => d.source !== "carried");
        const carried = r.docs.filter((d) => d.source === "carried");
        const satisfied = r.docs.length > 0 && (uploaded.length > 0 || (r.key === "prior_docs" && carried.length > 0));
        const missing = r.required && uploaded.length === 0;
        return (
          <li key={r.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
            <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${
              satisfied ? "border-pine bg-pine text-white" : missing ? "border-red-300 bg-red-50 text-red-600" : "border-line bg-white text-ink3"
            }`}>
              {satisfied ? <CheckCircle2 className="size-3" /> : missing ? <CircleAlert className="size-3" /> : <Paperclip className="size-2.5" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-medium text-ink">{r.label}</span>
                {r.required && <span className={`rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wider ${missing ? "bg-red-100 text-red-700" : "bg-paper2 text-ink3"}`}>Mandatory</span>}
              </div>
              {r.note && <div className="mt-0.5 text-[11px] text-ink3">{r.note}</div>}
              {r.docs.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {r.docs.map((d) => (
                    <span key={d.id} className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] ${d.source === "carried" ? "border-line bg-paper2/60 text-ink2" : "border-pine/25 bg-pine/5 text-pinedeep"}`}>
                      {d.source === "carried" ? <Archive className="size-3" /> : <FileText className="size-3" />}
                      <span className="max-w-56 truncate">{d.fileName ?? d.label}</span>
                      {d.source === "carried" && <span className="text-[9px] uppercase tracking-wider text-ink3">carried</span>}
                      {d.hasFile && (
                        <a href={`/api/files/${d.id}`} title="Download" className="text-pine hover:text-pinedeep">
                          <Download className="size-3" />
                        </a>
                      )}
                      <span className="text-[9.5px] text-ink3">{fmtSize(d.size)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
            {(canEdit || r.key === "signed_letter") && (
              <UploadControl caseId={caseId} requirementKey={r.key} label={r.label} disabled={!canEdit} compact />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function OtherUpload({ caseId, canEdit }: { caseId: number; canEdit: boolean }) {
  if (!canEdit) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line bg-paper2/40 px-5 py-3">
      <span className="flex items-center gap-2 text-[11.5px] text-ink2">
        <Plus className="size-3.5" /> Add any additional document needed for the case
      </span>
      <UploadControl caseId={caseId} requirementKey="" label="Other documents" disabled={!canEdit} compact />
    </div>
  );
}

export function SignedLetterUpload({
  caseId,
  canUpload,
  existing,
  ownerIsCad,
}: {
  caseId: number;
  canUpload: boolean;
  existing: DocItem | null;
  ownerIsCad: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {existing ? (
        <span className="inline-flex items-center gap-2 rounded-md border border-pine/30 bg-pine/5 px-3 py-2 text-[12.5px] text-pinedeep">
          <Signature className="size-4" />
          Signed release letter on file — {existing.fileName}
          {existing.hasFile && (
            <a href={`/api/files/${existing.id}`} className="text-pine hover:text-pinedeep" title="Download">
              <Download className="size-3.5" />
            </a>
          )}
        </span>
      ) : (
        <span className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
          <Signature className="size-4" />
          {ownerIsCad ? "CAD/CIC must complete, digitally sign and upload the CIB Release Letter." : "Download, sign/stamp/verify, then upload the digitally signed letter here."}
        </span>
      )}
      {canUpload && (
        <span className="inline-flex items-center gap-2">
          {existing && <Replace className="size-3.5 text-ink3" />}
          <UploadControl caseId={caseId} requirementKey="signed_letter" label="CIB Release Letter — digitally signed" disabled={false} compact />
        </span>
      )}
    </div>
  );
}

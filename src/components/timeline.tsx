import {
  Archive,
  ArrowRightLeft,
  BadgeCheck,
  CircleAlert,
  CircleQuestionMark,
  CircleX,
  FileSignature,
  HandMetal,
  Landmark,
  PauseCircle,
  PlayCircle,
  PlusCircle,
  RotateCcw,
  Send,
  ShieldCheck,
  Snowflake,
  Download,
} from "lucide-react";
import Link from "next/link";
import { fmtDateTime } from "@/lib/workflow";

export type EventItem = {
  id: number;
  action: string;
  actorName: string;
  fromStatus: string | null;
  toStatus: string | null;
  remarks: string | null;
  attachmentDocId: number | null;
  meta: Record<string, string>;
  createdAt: Date | string;
};

const ACTION_ICON: Record<string, { icon: typeof PlusCircle; cls: string }> = {
  CREATED: { icon: PlusCircle, cls: "bg-white text-ink2 border-line" },
  DATA_AUTOPOPULATED: { icon: Archive, cls: "bg-white text-pine border-pine/30" },
  SUBMITTED: { icon: Send, cls: "bg-ink text-paper border-ink" },
  HELD: { icon: PauseCircle, cls: "bg-white text-ink2 border-line" },
  RESUMED: { icon: PlayCircle, cls: "bg-white text-pine border-pine/40" },
  CLAIMED: { icon: HandMetal, cls: "bg-gold text-white border-gold" },
  APPROVED: { icon: BadgeCheck, cls: "bg-pine text-white border-pine" },
  FORWARDED: { icon: ArrowRightLeft, cls: "bg-white text-ink2 border-line" },
  RETURNED: { icon: RotateCcw, cls: "bg-red-100 text-red-700 border-red-300" },
  QUERY: { icon: CircleQuestionMark, cls: "bg-violet-100 text-violet-700 border-violet-300" },
  QUERY_ANSWERED: { icon: Send, cls: "bg-ink text-paper border-ink" },
  RESUBMITTED: { icon: Send, cls: "bg-ink text-paper border-ink" },
  REJECTED: { icon: CircleX, cls: "bg-red-700 text-white border-red-700" },
  CANCELLED: { icon: CircleX, cls: "bg-ink text-paper border-ink" },
  LETTER_GENERATED: { icon: FileSignature, cls: "bg-white text-cyan-700 border-cyan-300" },
  SIGNED_LETTER_UPLOADED: { icon: FileSignature, cls: "bg-cyan-100 text-cyan-800 border-cyan-300" },
  SUBMITTED_TO_CAD: { icon: Landmark, cls: "bg-blue-100 text-blue-800 border-blue-300" },
  REPORTED_TO_CIB: { icon: CircleAlert, cls: "bg-violet-100 text-violet-700 border-violet-300" },
  RETURNED_BY_CIB: { icon: CircleAlert, cls: "bg-red-100 text-red-700 border-red-300" },
  VALIDATION_RESUMED: { icon: PlayCircle, cls: "bg-white text-blue-700 border-blue-300" },
  BLACKLIST_RELEASED: { icon: ShieldCheck, cls: "bg-pine text-white border-pine" },
  PARTY_RELEASED: { icon: BadgeCheck, cls: "bg-pine/10 text-pine border-pine/30" },
  TEMPORARY_RELEASE_RECORDED: { icon: BadgeCheck, cls: "bg-cyan-100 text-cyan-800 border-cyan-300" },
  AUTO_UNFROZEN: { icon: Snowflake, cls: "bg-blue-600 text-white border-blue-600" },
  AUTO_UNFREEZE_SKIPPED: { icon: Snowflake, cls: "bg-white text-blue-400 border-blue-200" },
};

const ACTION_LABEL: Record<string, string> = {
  CREATED: "Case created",
  DATA_AUTOPOPULATED: "Data auto-populated",
  SUBMITTED: "Submitted for review",
  HELD: "Placed on hold",
  RESUMED: "Resumed",
  CLAIMED: "Claimed from BROPs pool",
  APPROVED: "Approved at review",
  FORWARDED: "Forwarded to another authority",
  RETURNED: "Returned for correction",
  QUERY: "Query raised",
  QUERY_ANSWERED: "Query answered & resubmitted",
  RESUBMITTED: "Corrected & resubmitted",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  LETTER_GENERATED: "Release letter generated",
  SIGNED_LETTER_UPLOADED: "Signed letter uploaded",
  SUBMITTED_TO_CAD: "Submitted to CAD/CIC",
  REPORTED_TO_CIB: "Reported to CIB",
  RETURNED_BY_CIB: "Returned by CIB",
  VALIDATION_RESUMED: "Validation resumed",
  BLACKLIST_RELEASED: "Blacklist released",
  PARTY_RELEASED: "Guarantor released (party level)",
  TEMPORARY_RELEASE_RECORDED: "Temporary release recorded",
  AUTO_UNFROZEN: "Automatic unfreeze applied",
  AUTO_UNFREEZE_SKIPPED: "Auto-unfreeze not authorised",
};

export function Timeline({ events, attachmentFiles }: { events: EventItem[]; attachmentFiles: Record<number, { fileName: string }> }) {
  return (
    <ol className="relative ml-2.5 border-l border-line pl-6">
      {events.map((e) => {
        const cfg = ACTION_ICON[e.action] ?? { icon: PlusCircle, cls: "bg-white text-ink2 border-line" };
        const Icon = cfg.icon;
        const att = e.attachmentDocId ? attachmentFiles[e.attachmentDocId] : null;
        return (
          <li key={e.id} className="relative pb-6 last:pb-0">
            <span className={`absolute -left-[35px] top-0 flex size-6 items-center justify-center rounded-full border ${cfg.cls}`}>
              <Icon className="size-3.5" />
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[13px] font-semibold text-ink">{ACTION_LABEL[e.action] ?? e.action}</span>
              <span className="text-[11px] text-ink2">by {e.actorName}</span>
              <span className="font-mono text-[10px] text-ink3">{fmtDateTime(e.createdAt)}</span>
            </div>
            {e.fromStatus && e.toStatus && e.fromStatus !== e.toStatus && (
              <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-ink3">
                {e.fromStatus.replace(/_/g, " ")} → {e.toStatus.replace(/_/g, " ")}
              </div>
            )}
            {e.remarks && (
              <blockquote className="mt-2 border-l-2 border-gold/60 bg-paper2/40 py-2 pl-3 pr-4 font-display text-[13px] italic leading-relaxed text-ink2">
                {e.remarks}
              </blockquote>
            )}
            {att && (
              <Link
                href={`/api/files/${e.attachmentDocId}`}
                className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1.5 text-[11px] font-medium text-ink2 transition-colors hover:border-pine/50 hover:text-pine"
              >
                <Download className="size-3" /> {att.fileName}
              </Link>
            )}
            {e.meta?.requestNumber && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-violet-300 bg-violet-50 px-2.5 py-1.5 font-mono text-[11px] font-medium text-violet-800">
                CIB Request No. {e.meta.requestNumber}
              </div>
            )}
            {e.meta?.until && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-cyan-300 bg-cyan-50 px-2.5 py-1.5 font-mono text-[11px] font-medium text-cyan-800">
                Temporary until {e.meta.until}
              </div>
            )}
            {e.meta?.to && (
              <div className="mt-2 text-[11.5px] text-ink2">→ {e.meta.to}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

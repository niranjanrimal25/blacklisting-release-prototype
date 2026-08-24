"use client";

import { useState } from "react";
import { 
  Play, 
  FileSearch, 
  ListChecks, 
  Upload, 
  Users, 
  Eye, 
  Wrench, 
  MessageCircle,
  FileSignature,
  Landmark,
  CheckCircle2,
  XCircle,
  PauseCircle,
  GitBranch,
  Info
} from "lucide-react";

type Node = {
  id: string;
  label: string;
  sub: string;
  x: number;
  y: number;
  type: "start" | "task" | "gateway" | "end";
  lane: "initiator" | "reviewer" | "brops" | "cad" | "system";
  icon: any;
  details: string;
};

const NODES: Node[] = [
  { id: "start", label: "Start", sub: "New Case Request", x: 50, y: 50, type: "start", lane: "system", icon: Play, details: "Process starts when initiator clicks 'Start blacklisting release' from dashboard. Triggers DigiHost lookup." },
  { id: "T01", label: "Identify Case", sub: "DigiHost auto-population", x: 200, y: 50, type: "task", lane: "initiator", icon: FileSearch, details: "Search by Case No (primary), CIF ID, Blacklist No, Party Name. Auto-populates party, freeze codes, cheque/npa details, prior docs. Manual fallback if not found. Trigger: TRG_LOOKUP_BLACKLIST" },
  { id: "T02", label: "Select Type & Details", sub: "6 release types", x: 400, y: 50, type: "task", lane: "initiator", icon: ListChecks, details: "Choose one of 6 types: RL-01 applicant cheque, RL-02 ac-holder cheque, RL-03 court, RL-04 NPA, RL-05 partial guarantor, RL-06 temporary 6mo. Each shows type-specific fields & outcome note. Sets letterOwner (initiator for cheque/court, cad for NPA/partial/temporary) and poolEligible." },
  { id: "T03", label: "Upload Mandatory Docs", sub: "Maker completeness", x: 600, y: 50, type: "task", lane: "initiator", icon: Upload, details: "Type-specific checklist. Mandatory docs must be uploaded before Proceed. Trigger TRG_MAKER_COMPLETENESS_CHECK blocks if missing. Input Docs: copy_cheque, payee_application, mdr_copy, id_holder, cib_inclusion_letter etc." },
  { id: "G01", label: "Route by Structure", sub: "Exclusive Gateway", x: 800, y: 50, type: "gateway", lane: "system", icon: GitBranch, details: "Gateway G01_Route_Mode: if @@routeMode == 'pool' → BROPs Pool (for BOC-reporting branches), else → Review (OI/BM)" },
  { id: "T04a", label: "BROPs Pool", sub: "Self-Service Claim", x: 800, y: 180, type: "task", lane: "brops", icon: Users, details: "Cheque types routed to unassigned pool. BROPs user clicks Claim → assigned. Trigger TRG_CLAIM_FROM_POOL. Notifies initiator." },
  { id: "T04b", label: "Review", sub: "Approve/Return/Query", x: 950, y: 50, type: "task", lane: "reviewer", icon: Eye, details: "Reviewer sees case data + docs. Actions: APPROVE (→ letter), RETURN (correction, remarks mandatory), QUERY (clarification, remarks mandatory), FORWARD (to another reviewer), REJECT (closes). Trigger TRG_VALIDATE_REVIEW." },
  { id: "G02", label: "Review Decision", sub: "Exclusive Gateway", x: 1100, y: 50, type: "gateway", lane: "system", icon: GitBranch, details: "After review: APPROVE → Letter Gateway, RETURN → Rectify, QUERY → Clarify, FORWARD → loop to Review, REJECT → End Rejected" },
  { id: "T05a", label: "Rectify After Return", sub: "Initiator correction", x: 1100, y: 180, type: "task", lane: "initiator", icon: Wrench, details: "Initiator sees reviewer remarks @@reviewRemarks, corrects data/docs, then FORWARD_AFTER_RETURN → back to Review" },
  { id: "T05b", label: "Clarify After Query", sub: "Initiator clarification", x: 1250, y: 180, type: "task", lane: "initiator", icon: MessageCircle, details: "Same as rectify but for Query – clarification only, not correction" },
  { id: "G03", label: "Letter Owner", sub: "Exclusive Gateway", x: 1250, y: 50, type: "gateway", lane: "system", icon: GitBranch, details: "If letterOwner == initiator (cheque/court) → Initiator Signs, else cad (NPA/partial/temporary) → CAD Completes. Output Doc OD_CIB_RELEASE_LETTER auto-generated after Approve." },
  { id: "T06a", label: "Letter – Initiator", sub: "Download, Sign, Upload", x: 1400, y: 50, type: "task", lane: "initiator", icon: FileSignature, details: "Initiator downloads generated CIB letter (individual vs entity format), signs/stamps, uploads digitally signed as IN_SIGNED_LETTER. Trigger TRG_CHECK_SIGNED_LETTER blocks if missing. Then SUBMIT_TO_CAD." },
  { id: "T06b", label: "Letter – CAD", sub: "Complete & Sign", x: 1400, y: 180, type: "task", lane: "cad", icon: FileSignature, details: "CAD/CIC completes letter on CAD screen, digitally signs, uploads. Same check." },
  { id: "T07", label: "CAD/CIC Validation", sub: "Final Release", x: 1550, y: 50, type: "task", lane: "cad", icon: Landmark, details: "CAD actions: RELEASE (checks signed_letter, sets RELEASED, handles partial/temporary, auto-unfreeze 002/025/100), CAD_RETURN/QUERY (remarks+attachment mandatory), CIB_RETURNED (attachment), CIB_REPORTED (requestNumber+remarks), RESUME_VALIDATION. Trigger TRG_RELEASE_BLACKLIST." },
  { id: "G04", label: "CAD Decision", sub: "Exclusive Gateway", x: 1700, y: 50, type: "gateway", lane: "system", icon: GitBranch, details: "RELEASE → End Released, CAD_RETURN → Rectify, CAD_QUERY → Clarify, CIB_RETURNED → CIB Returned loop, CIB_REPORTED → loop" },
  { id: "end_released", label: "Released", sub: "Blacklist removed", x: 1850, y: 50, type: "end", lane: "system", icon: CheckCircle2, details: "Blacklist status = released (or partially/temporary), account unfrozen if eligible (single 002/025/100). Final Output Doc OD_FINAL_RELEASE_DOCUMENT available for initiator download." },
  { id: "end_rejected", label: "Rejected", sub: "Case closed", x: 1100, y: 300, type: "end", lane: "system", icon: XCircle, details: "Case rejected at review or CAD, closed, initiator notified." },
  { id: "end_cancelled", label: "Cancelled", sub: "Initiator cancelled", x: 600, y: 300, type: "end", lane: "system", icon: PauseCircle, details: "Initiator cancels in DRAFT/ON_HOLD/RETURNED/QUERY/LETTER_PENDING" },
];

const FLOWS = [
  { from: "start", to: "T01" },
  { from: "T01", to: "T02" },
  { from: "T02", to: "T03" },
  { from: "T03", to: "G01" },
  { from: "G01", to: "T04a", label: 'pool' },
  { from: "G01", to: "T04b", label: 'direct' },
  { from: "T04a", to: "T04b" },
  { from: "T04b", to: "G02" },
  { from: "G02", to: "T06a", label: 'approve initiator' },
  { from: "G02", to: "T06b", label: 'approve cad' },
  { from: "G02", to: "T05a", label: 'return' },
  { from: "G02", to: "T05b", label: 'query' },
  { from: "G02", to: "end_rejected", label: 'reject' },
  { from: "T05a", to: "T04b" },
  { from: "T05b", to: "T04b" },
  { from: "T06a", to: "T07" },
  { from: "T06b", to: "T07" },
  { from: "T07", to: "G04" },
  { from: "G04", to: "end_released", label: 'release' },
  { from: "G04", to: "T05a", label: 'cad return' },
  { from: "G04", to: "T05b", label: 'cad query' },
  { from: "G04", to: "T07", label: 'cib reported' },
  { from: "T03", to: "end_cancelled", label: 'cancel' },
];

const LANE_COLORS: Record<string, string> = {
  initiator: "bg-[#d6eaf8] border-[#85c1e9]",
  reviewer: "bg-[#d5f5e3] border-[#82e0aa]",
  brops: "bg-[#fdebd0] border-[#f5cba7]",
  cad: "bg-[#e8daef] border-[#d2b4de]",
  system: "bg-[#f2f3f4] border-[#bdc3c7]",
};

export function FlowDiagram({ highlightId }: { highlightId?: string }) {
  const [selected, setSelected] = useState<Node | null>(NODES[1]);
  const [hovered, setHovered] = useState<string | null>(null);

  const getNode = (id: string) => NODES.find(n => n.id === id);

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Diagram */}
      <div className="flex-1 overflow-auto border border-[#bdc3c7] bg-white rounded-lg p-2" style={{ minHeight: 400 }}>
        <div className="relative" style={{ width: 1950, height: 380 }}>
          {/* Flows as lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ width: 1950, height: 380 }}>
            {FLOWS.map((f, i) => {
              const from = getNode(f.from);
              const to = getNode(f.to);
              if (!from || !to) return null;
              const isHighlighted = hovered === f.from || hovered === f.to || highlightId === f.from || highlightId === f.to;
              return (
                <g key={i}>
                  <line
                    x1={from.x + 70}
                    y1={from.y + 25}
                    x2={to.x + 10}
                    y2={to.y + 25}
                    stroke={isHighlighted ? "#e74c3c" : "#95a5a6"}
                    strokeWidth={isHighlighted ? 2 : 1}
                    markerEnd="url(#arrow)"
                    strokeDasharray={f.label ? "4 2" : "0"}
                  />
                  {f.label && (
                    <text x={(from.x + to.x)/2 + 40} y={(from.y + to.y)/2 + 20} fontSize="9" fill="#7f8c8d" fontFamily="monospace">{f.label}</text>
                  )}
                </g>
              );
            })}
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#95a5a6" />
              </marker>
            </defs>
          </svg>

          {/* Nodes */}
          {NODES.map(node => {
            const Icon = node.icon;
            const isSelected = selected?.id === node.id;
            const isHighlighted = highlightId === node.id || hovered === node.id;
            const laneColor = LANE_COLORS[node.lane];
            return (
              <div
                key={node.id}
                onClick={() => setSelected(node)}
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
                className={`absolute flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all text-[11px] ${laneColor} ${isSelected ? "ring-2 ring-[#e74c3c] scale-105 shadow-lg" : ""} ${isHighlighted ? "shadow-md" : ""} ${node.type === "gateway" ? "rotate-45 w-12 h-12 !p-0 justify-center" : "w-[140px]"} ${node.type === "start" ? "rounded-full bg-[#27ae60] text-white border-[#27ae60]" : ""} ${node.type === "end" ? "rounded-full bg-[#2c3e50] text-white border-[#2c3e50]" : ""}`}
                style={{ left: node.x, top: node.y }}
              >
                <div className={`${node.type === "gateway" ? "-rotate-45 flex flex-col items-center" : "flex items-center gap-2"}`}>
                  <Icon className="size-4 shrink-0" />
                  {node.type !== "gateway" && (
                    <div className="leading-tight">
                      <div className="font-bold">{node.label}</div>
                      <div className="text-[9px] opacity-70">{node.sub}</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Details panel */}
      <div className="w-full lg:w-[340px] space-y-3">
        <div className="border border-[#bdc3c7] rounded-lg bg-white overflow-hidden">
          <div className="bg-[#2c3e50] text-white px-3 py-2 font-bold text-[12px] flex items-center gap-2">
            <Info className="size-4" /> {selected ? selected.label : "Select a node"}
          </div>
          {selected && (
            <div className="p-4 space-y-3 text-[11.5px] leading-relaxed">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${LANE_COLORS[selected.lane]}`}>{selected.lane}</span>
                <span className="font-mono text-[10px] bg-[#f2f3f4] px-1.5 py-0.5 rounded">{selected.type}</span>
                <span className="font-mono text-[10px]">{selected.id}</span>
              </div>
              <div className="font-bold text-[#2c3e50]">{selected.label} – {selected.sub}</div>
              <div className="text-[#5d6d7e]">{selected.details}</div>
              <div className="pt-2 border-t border-[#e5e8e8] text-[10px] font-mono text-[#95a5a6]">
                Click any node to see trigger, Dynaform, Input/Output docs. This mimics PM 3.8 Designer interaction.
              </div>
            </div>
          )}
        </div>

        <div className="border border-[#bdc3c7] rounded-lg bg-[#fef9e7] p-3 text-[11px]">
          <div className="font-bold text-[#7d6608]">How to Start a Case (PM 3.8 style)</div>
          <ol className="mt-2 space-y-1.5 list-decimal list-inside text-[#7e5109]">
            <li><strong>Login</strong> as Initiator (Branch/NPA/CSD) from /login</li>
            <li>Dashboard → <strong>Start blacklisting release</strong></li>
            <li><strong>Identify:</strong> Enter Case No/CIF/Blacklist No → Retrieve (auto-population)</li>
            <li><strong>Release Type:</strong> Choose 1 of 6 (RL-01..RL-06)</li>
            <li><strong>Details:</strong> Fill type-specific fields (charges mandatory)</li>
            <li><strong>Routing:</strong> BROPs Pool vs OI/BM</li>
            <li>Create → Draft → Upload mandatory Input Docs → <strong>Proceed</strong> (maker check)</li>
            <li>Reviewer Approves → Letter generated → Initiator/CAD signs & uploads → CAD RELEASE → Final doc</li>
          </ol>
        </div>

        <div className="border border-[#bdc3c7] rounded-lg bg-white p-3 text-[10.5px]">
          <div className="font-bold">Legend</div>
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2"><span className="w-3 h-3 bg-[#d6eaf8] border border-[#85c1e9] rounded"></span> Initiator (Branch/NPA/CSD)</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 bg-[#d5f5e3] border border-[#82e0aa] rounded"></span> Reviewer OI/BM</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 bg-[#fdebd0] border border-[#f5cba7] rounded"></span> BROPs Pool</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 bg-[#e8daef] border border-[#d2b4de] rounded"></span> CAD/CIC</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 bg-[#27ae60] rounded-full"></span> Start | <span className="w-3 h-3 bg-[#2c3e50] rounded-full"></span> End | <span className="w-3 h-3 bg-[#f2f3f4] border rotate-45"></span> Gateway</div>
          </div>
        </div>
      </div>
    </div>
  );
}

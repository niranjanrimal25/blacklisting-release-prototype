import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { db, ensureReady } from "@/db";
import { releaseCases } from "@/db/schema";
import { desc } from "@/db";
import { FlowDiagram } from "@/components/flow-diagram";
import { Card } from "@/components/ui";
import Link from "next/link";
import { DraftingCompass, Download, Layers, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DesignerPage({ searchParams }: { searchParams: Promise<{ caseId?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  await ensureReady();

  const { caseId } = await searchParams;
  const cases = await db.select().from(releaseCases).orderBy(desc(releaseCases.updatedAt)).limit(10);

  let highlightId: string | undefined;
  if (caseId) {
    const [kase] = await db.select().from(releaseCases).where((() => {
      const { eq } = require("@/db");
      return eq(releaseCases.id, Number(caseId));
    })()).limit(1);
    if (kase) {
      // Map status to diagram node
      const statusMap: Record<string, string> = {
        DRAFT: "T03",
        ON_HOLD: "T03",
        PENDING_REVIEW: kase.routedToPool && !kase.reviewerId ? "T04a" : "T04b",
        RETURNED: "T05a",
        QUERY: "T05b",
        LETTER_PENDING: kase.data?.letterOwner === "cad" ? "T06b" : "T06a",
        PENDING_CAD: "T07",
        CIB_RETURNED: "T07",
        CIB_REPORTED: "T07",
        RELEASED: "end_released",
        REJECTED: "end_rejected",
        CANCELLED: "end_cancelled",
      };
      highlightId = statusMap[kase.status] ?? "T01";
    }
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-[#2c3e50] rounded flex items-center justify-center text-white">
          <DraftingCompass className="size-5" />
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#e67e22]">ProcessMaker 3.8 Designer – Interactive Flow</div>
          <h1 className="font-display text-[28px] font-bold tracking-tight text-[#2c3e50]">Blacklisting Release Full SOP – Flow Diagram</h1>
          <p className="text-[12px] text-[#5d6d7e]">Click any task/gateway to see Dynaform, Trigger, Input/Output docs. This mimics PM 3.8 Designer where you can see and interact with the flow.</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Link href="/pm38" className="bg-[#18bc9c] text-white px-3 py-2 rounded text-[11px] font-bold hover:bg-[#16a085]">PM 3.8 Inbox</Link>
          <Link href="/processmaker-3.8/Blacklisting_Release_Full_SOP.pmx" className="bg-[#2c3e50] text-white px-3 py-2 rounded text-[11px] flex items-center gap-1"><Download className="size-3" /> Download .pmx</Link>
        </div>
      </div>

      <Card className="mt-6 p-4">
        <FlowDiagram highlightId={highlightId} />
      </Card>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4">
          <h3 className="font-bold text-[13px] flex items-center gap-2"><Layers className="size-4" /> PM Tables (Blacklist Register)</h3>
          <p className="text-[11px] text-[#7f8c8d] mt-1">This is where DigiHost cases are stored. Auto-population queries this table.</p>
          <Link href="/register" className="mt-2 inline-block text-[11px] text-[#2980b9] hover:underline">Open Blacklist Register →</Link>
          <div className="mt-3 bg-[#f8f9f9] border border-[#e5e8e8] p-2 font-mono text-[10px]">
            SELECT * FROM BLACKLIST_REGISTER WHERE case_number = @@searchIdentifier
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="font-bold text-[13px] flex items-center gap-2"><FileText className="size-4" /> How to Start Case (Initiator)</h3>
          <ol className="mt-2 text-[11px] space-y-1 list-decimal list-inside">
            <li>Login as Initiator (Asha Rai – Branch, Deepak – NPA, Mira – CSD)</li>
            <li>Dashboard → Start blacklisting release</li>
            <li>Identify: search DH-2025-03417 → auto-populated</li>
            <li>Release Type: pick 1 of 6 (RL-01..RL-06)</li>
            <li>Details: fill cheque/LOS/NRRC/EMI fields</li>
            <li>Routing: BROPs Pool vs OI/BM</li>
            <li>Create → Draft → Upload mandatory docs → Proceed</li>
          </ol>
          <Link href="/cases/new" className="mt-2 inline-block bg-[#27ae60] text-white px-3 py-1.5 rounded text-[11px]">Start New Case</Link>
        </Card>
        <Card className="p-4">
          <h3 className="font-bold text-[13px]">Interactive Legend – Click to Explore</h3>
          <div className="mt-2 text-[11px] space-y-2">
            <div><strong>T01 Identify:</strong> Dynaform DF_IDENTIFY_CASE + Trigger TRG_LOOKUP_BLACKLIST</div>
            <div><strong>T03 Upload:</strong> Input Docs per type + Trigger TRG_MAKER_COMPLETENESS_CHECK</div>
            <div><strong>T04b Review:</strong> Dynaform DF_REVIEW_DECISION + Trigger TRG_VALIDATE_REVIEW</div>
            <div><strong>T06 Letter:</strong> Output Doc OD_CIB_RELEASE_LETTER (individual/entity)</div>
            <div><strong>T07 CAD:</strong> Trigger TRG_RELEASE_BLACKLIST (partial/temporary/auto-unfreeze 002/025/100)</div>
          </div>
          {caseId && <div className="mt-3 bg-[#d5f5e3] border border-[#82e0aa] p-2 text-[11px]">Highlighting case {caseId} status → node {highlightId}</div>}
          <div className="mt-3">
            <div className="text-[10px] font-bold uppercase">Recent Cases (click to highlight)</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {cases.map((c: any) => (
                <Link key={c.id} href={`/designer?caseId=${c.id}`} className={`px-2 py-1 rounded text-[10px] font-mono border ${Number(caseId) === c.id ? "bg-[#2c3e50] text-white border-[#2c3e50]" : "bg-white border-[#bdc3c7] hover:bg-[#eaf2f8]"}`}>{c.reference}</Link>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

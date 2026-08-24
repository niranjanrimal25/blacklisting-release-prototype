import Link from "next/link";
import { redirect } from "next/navigation";
import { desc } from "@/db";
import { db, ensureReady } from "@/db";
import { blacklistRecords, releaseCases, users } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { RELEASE_TYPES, fmtDate, type ReleaseTypeKey } from "@/lib/workflow";
import { Pm38CaseListHeader } from "@/components/pm38-shell";

export const dynamic = "force-dynamic";

export default async function Pm38InboxPage({ searchParams }: { searchParams: Promise<{ folder?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  await ensureReady();
  const { folder } = await searchParams;
  const currentFolder = folder ?? "inbox";

  const [cases, allUsers] = await Promise.all([
    db.select().from(releaseCases).orderBy(desc(releaseCases.updatedAt)),
    db.select().from(users),
  ]);

  const nameOf = (id: string) => allUsers.find((u: any) => u.id === id)?.name ?? id;

  let filtered: typeof cases = [];
  if (currentFolder === "inbox") {
    // Inbox: cases assigned to you for review or CAD or letter stage
    filtered = cases.filter((c: any) => {
      if (c.initiatorId === user.id && ["DRAFT","ON_HOLD","RETURNED","QUERY","LETTER_PENDING"].includes(c.status)) return false; // draft folder
      if (c.status === "PENDING_REVIEW" && (c.reviewerId === user.id)) return true;
      if (c.status === "PENDING_REVIEW" && user.role === "brops" && c.routedToPool && !c.reviewerId) return false; // unassigned
      if (["PENDING_CAD","CIB_REPORTED","CIB_RETURNED"].includes(c.status) && user.role === "cad") return true;
      if (c.status === "LETTER_PENDING") {
        const def = RELEASE_TYPES[c.releaseType as ReleaseTypeKey];
        if (def.letterOwner === "initiator" && c.initiatorId === user.id) return true;
        if (def.letterOwner === "cad" && user.role === "cad") return true;
      }
      return false;
    });
  } else if (currentFolder === "draft") {
    filtered = cases.filter((c: any) => c.initiatorId === user.id && ["DRAFT","ON_HOLD","RETURNED","QUERY","LETTER_PENDING"].includes(c.status));
  } else if (currentFolder === "unassigned") {
    filtered = cases.filter((c: any) => c.status === "PENDING_REVIEW" && c.routedToPool && !c.reviewerId);
  } else if (currentFolder === "paused") {
    filtered = cases.filter((c: any) => c.status === "ON_HOLD");
  } else if (currentFolder === "participated") {
    filtered = cases.filter((c: any) => c.initiatorId === user.id || c.reviewerId === user.id);
  }

  return (
    <div className="bg-white border border-[#bdc3c7] min-h-[600px]">
      <Pm38CaseListHeader folder={currentFolder} />

      {/* Classic PM 3.8 toolbar */}
      <div className="bg-[#f2f3f4] border-b border-[#bdc3c7] px-3 py-2 flex items-center gap-2 text-[11px]">
        <span className="font-bold text-[#2c3e50]">Process:</span>
        <select className="border border-[#bdc3c7] px-2 py-1 bg-white text-[11px]">
          <option>All Processes</option>
          <option selected>Blacklisting Release Full SOP</option>
        </select>
        <span className="ml-4 font-bold text-[#2c3e50]">Search:</span>
        <input className="border border-[#bdc3c7] px-2 py-1 w-48 text-[11px]" placeholder="Case #, CIF, Blacklist No..." />
        <button className="bg-[#2e86c1] text-white px-3 py-1 rounded hover:bg-[#1a5276]">Search</button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[#7f8c8d]">Total: {filtered.length}</span>
          <Link href="/cases/new" className="bg-[#27ae60] text-white px-3 py-1 rounded hover:bg-[#1e8449]">+ New Case</Link>
        </div>
      </div>

      {/* Classic PM 3.8 case list table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="bg-[#d5dbdb] text-[#2c3e50] font-bold border-b border-[#bdc3c7]">
              <th className="text-left px-3 py-2 border-r border-[#bdc3c7] w-8"><input type="checkbox" /></th>
              <th className="text-left px-3 py-2 border-r border-[#bdc3c7]">Case #</th>
              <th className="text-left px-3 py-2 border-r border-[#bdc3c7]">Process</th>
              <th className="text-left px-3 py-2 border-r border-[#bdc3c7]">Task / Current Step</th>
              <th className="text-left px-3 py-2 border-r border-[#bdc3c7]">Party Name</th>
              <th className="text-left px-3 py-2 border-r border-[#bdc3c7]">Blacklist No</th>
              <th className="text-left px-3 py-2 border-r border-[#bdc3c7]">Sender / Initiator</th>
              <th className="text-left px-3 py-2 border-r border-[#bdc3c7]">Due Date</th>
              <th className="text-left px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="text-center py-8 text-[#7f8c8d]">No cases in this folder. This mimics PM 3.8 Inbox/Draft/Unassigned.</td></tr>
            )}
            {filtered.map((c: any, idx: number) => {
              const def = RELEASE_TYPES[c.releaseType as ReleaseTypeKey];
              const isEven = idx % 2 === 0;
              return (
                <tr key={c.id} className={`border-b border-[#e5e8e8] hover:bg-[#eaf2f8] ${isEven ? "bg-[#f8f9f9]" : "bg-white"}`}>
                  <td className="px-3 py-2 border-r border-[#e5e8e8]"><input type="checkbox" /></td>
                  <td className="px-3 py-2 border-r border-[#e5e8e8] font-mono font-bold text-[#2980b9]">
                    <Link href={`/pm38/cases/${c.id}`} className="hover:underline">{c.reference}</Link>
                  </td>
                  <td className="px-3 py-2 border-r border-[#e5e8e8] text-[#2c3e50]">{def.short}</td>
                  <td className="px-3 py-2 border-r border-[#e5e8e8]">
                    <span className="bg-[#fdebd0] border border-[#f5cba7] px-1.5 py-0.5 rounded text-[#7e5109]">{c.status}</span>
                  </td>
                  <td className="px-3 py-2 border-r border-[#e5e8e8] font-medium text-[#2c3e50]">{c.data.partyName}</td>
                  <td className="px-3 py-2 border-r border-[#e5e8e8] font-mono text-[#5d6d7e]">{c.data.blacklistNumber}</td>
                  <td className="px-3 py-2 border-r border-[#e5e8e8] text-[#5d6d7e]">{nameOf(c.initiatorId)}</td>
                  <td className="px-3 py-2 border-r border-[#e5e8e8] text-[#5d6d7e]">{fmtDate(c.updatedAt)}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${c.status === "RELEASED" ? "bg-[#27ae60] text-white border-[#27ae60]" : c.status === "PENDING_REVIEW" ? "bg-[#f39c12] text-white border-[#f39c12]" : "bg-[#ecf0f1] text-[#2c3e50] border-[#bdc3c7]"}`}>{c.status}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-[#f2f3f4] border-t border-[#bdc3c7] px-3 py-2 text-[10px] text-[#7f8c8d] flex justify-between">
        <span>ProcessMaker 3.8 Community – Blacklisting Release Full SOP – {filtered.length} cases</span>
        <span>Page 1 of 1 | In-memory DB: .memory-data.json | No DB config needed</span>
      </div>
    </div>
  );
}

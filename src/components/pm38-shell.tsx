"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { 
  Home, 
  LayoutDashboard, 
  FolderOpen, 
  FileText, 
  Inbox, 
  DraftingCompass,
  Users,
  CheckSquare,
  Clock,
  FilePlus2,
  Layers,
  ShieldCheck,
  LogOut,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { logout } from "@/app/actions";
import { roleLabel } from "@/lib/workflow";

type NavUser = { id: string; name: string; role: string; unit: string; title: string };

const CASE_FOLDERS = [
  { id: "inbox", label: "Inbox", icon: Inbox, count: 0 },
  { id: "draft", label: "Draft", icon: FileText, count: 0 },
  { id: "participated", label: "Participated", icon: CheckSquare, count: 0 },
  { id: "unassigned", label: "Unassigned (BROPs Pool)", icon: Users, count: 0 },
  { id: "paused", label: "Paused / On Hold", icon: Clock, count: 0 },
];

export function Pm38Header({ user }: { user: NavUser }) {
  return (
    <div className="h-10 bg-[#2d3e50] border-b border-[#1a252f] flex items-center justify-between px-4 text-white">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#18bc9c] rounded flex items-center justify-center font-bold text-[14px]">PM</div>
          <span className="font-bold text-[14px] tracking-wide">ProcessMaker</span>
          <span className="text-[10px] bg-[#1a252f] px-1.5 py-0.5 rounded font-mono">3.8</span>
          <span className="text-white/50">|</span>
          <span className="text-[12px] text-white/80">Blacklisting Release Full SOP</span>
        </div>
      </div>
      <div className="flex items-center gap-4 text-[11px]">
        <span className="text-white/60">Workspace: <span className="text-white">workflow</span></span>
        <span className="text-white/60">User: <span className="text-white font-medium">{user.name}</span> ({roleLabel(user.role)})</span>
        <button onClick={() => logout()} className="flex items-center gap-1.5 bg-[#c0392b] hover:bg-[#a93226] px-2.5 py-1 rounded text-white">
          <LogOut className="size-3" /> Logout
        </button>
      </div>
    </div>
  );
}

export function Pm38Sidebar({ user, poolCount, myDraftCount, inboxCount }: { user: NavUser; poolCount: number; myDraftCount: number; inboxCount: number }) {
  const pathname = usePathname();
  const [openCases, setOpenCases] = useState(true);
  const [openDesigner, setOpenDesigner] = useState(false);

  const folders = CASE_FOLDERS.map(f => {
    if (f.id === "draft") return { ...f, count: myDraftCount };
    if (f.id === "inbox") return { ...f, count: inboxCount };
    if (f.id === "unassigned") return { ...f, count: poolCount };
    return f;
  });

  return (
    <div className="w-56 bg-[#ecf0f1] border-r border-[#bdc3c7] flex flex-col text-[12px]">
      <div className="p-3 border-b border-[#bdc3c7] bg-[#d5dbdb]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#2c3e50] text-white flex items-center justify-center font-bold text-[11px]">
            {user.name.split(" ").map(w=>w[0]).join("").slice(0,2)}
          </div>
          <div>
            <div className="font-bold text-[#2c3e50] text-[12px]">{user.name}</div>
            <div className="text-[10px] text-[#7f8c8d]">{user.unit}</div>
          </div>
        </div>
        <Link href="/login" className="mt-2 block text-[10px] text-[#2980b9] hover:underline">Switch Role</Link>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          <Link href="/dashboard" className={`flex items-center gap-2 px-2 py-1.5 rounded ${pathname === "/dashboard" ? "bg-[#2c3e50] text-white" : "text-[#2c3e50] hover:bg-[#d5dbdb]"}`}>
            <Home className="size-4" /> Home
          </Link>
          <Link href="/pm38" className={`flex items-center gap-2 px-2 py-1.5 rounded mt-1 ${pathname.startsWith("/pm38") ? "bg-[#18bc9c] text-white font-bold" : "text-[#2c3e50] hover:bg-[#d5dbdb] bg-[#f8c471]/30 border border-[#f39c12]/30"}`}>
            <LayoutDashboard className="size-4" /> PM 3.8 Style Prototype
          </Link>
        </div>

        <div className="mt-2">
          <button onClick={() => setOpenCases(!openCases)} className="w-full flex items-center gap-1 px-3 py-1.5 font-bold text-[#2c3e50] bg-[#bdc3c7]/50 hover:bg-[#bdc3c7]">
            {openCases ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            <FolderOpen className="size-4" /> Cases
          </button>
          {openCases && (
            <div className="bg-white border-y border-[#bdc3c7]">
              {folders.map(f => (
                <Link
                  key={f.id}
                  href={`/pm38?folder=${f.id}`}
                  className={`flex items-center justify-between px-6 py-1.5 hover:bg-[#eaf2f8] ${pathname === "/pm38" ? "text-[#2c3e50]" : ""}`}
                >
                  <span className="flex items-center gap-2"><f.icon className="size-3.5" /> {f.label}</span>
                  {f.count > 0 && <span className="bg-[#e74c3c] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{f.count}</span>}
                </Link>
              ))}
              <Link href="/cases/new" className="flex items-center gap-2 px-6 py-1.5 text-[#27ae60] hover:bg-[#eafaf1] font-medium">
                <FilePlus2 className="size-3.5" /> New Case (Start Release)
              </Link>
            </div>
          )}
        </div>

        <div className="mt-1">
          <button onClick={() => setOpenDesigner(!openDesigner)} className="w-full flex items-center gap-1 px-3 py-1.5 font-bold text-[#2c3e50] bg-[#bdc3c7]/50 hover:bg-[#bdc3c7]">
            {openDesigner ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            <DraftingCompass className="size-4" /> Designer
          </button>
          {openDesigner && (
            <div className="bg-white border-y border-[#bdc3c7] px-6 py-2 text-[11px] text-[#7f8c8d] space-y-1">
              <div>• Process: Blacklisting Release Full SOP</div>
              <div>• Tasks: 10</div>
              <div>• Dynaforms: 13</div>
              <div>• Triggers: 7</div>
              <div>• Input Docs: 18</div>
              <div>• Output Docs: 2</div>
              <div className="pt-1">
                <Link href="/register" className="text-[#2980b9] hover:underline flex items-center gap-1"><Layers className="size-3" /> Blacklist Register (PM Table)</Link>
              </div>
              <div>
                <Link href="/pool" className="text-[#2980b9] hover:underline flex items-center gap-1"><Users className="size-3" /> BROPs Pool (Self-Service)</Link>
              </div>
            </div>
          )}
        </div>

        <div className="p-3 mt-4 bg-[#fdebd0] border border-[#f5cba7] rounded mx-2 text-[10.5px] text-[#7e5109]">
          <div className="font-bold flex items-center gap-1"><ShieldCheck className="size-3" /> PM 3.8 Prototype Notes</div>
          <div className="mt-1 leading-relaxed">
            This UI mimics PM 3.8 classic. Real PM 3.8 uses ExtJS + PHP. This is Next.js with in-memory DB (no DB config) but same triggers & routing.
          </div>
        </div>
      </div>
    </div>
  );
}

export function Pm38CaseListHeader({ folder }: { folder: string }) {
  const titles: Record<string, { title: string; desc: string }> = {
    inbox: { title: "Inbox", desc: "Cases assigned to you for action – Approve, Return, Query, Forward, Reject, Claim, Release" },
    draft: { title: "Draft", desc: "Cases you initiated in Draft/On Hold/Returned/Query – complete docs then Proceed" },
    participated: { title: "Participated", desc: "Cases you participated in – history" },
    unassigned: { title: "Unassigned – BROPs Pool", desc: "Unclaimed cheque-release cases routed to BROPs pool" },
    paused: { title: "Paused / On Hold", desc: "Cases placed on hold" },
  };
  const info = titles[folder] ?? titles["inbox"];
  return (
    <div className="bg-[#d6eaf8] border border-[#aed6f1] px-4 py-3 flex items-center justify-between">
      <div>
        <div className="font-bold text-[#1a5276] text-[14px]">{info.title}</div>
        <div className="text-[11px] text-[#2e86c1]">{info.desc}</div>
      </div>
      <div className="text-[10px] font-mono text-[#5d6d7e]">Folder: {folder} | PM 3.8 Style</div>
    </div>
  );
}

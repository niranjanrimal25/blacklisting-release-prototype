"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { HandMetal } from "lucide-react";
import { simpleCaseAction } from "@/app/actions";

export function ClaimButton({ caseId }: { caseId: number }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      {error && <span className="max-w-44 text-[11px] text-red-700">{error}</span>}
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await simpleCaseAction(caseId, "CLAIM");
            if (!res.ok) setError(res.error);
            else router.push(`/cases/${caseId}`);
          })
        }
        className="inline-flex items-center gap-1.5 rounded-md bg-pine px-3 py-2 text-[12px] font-medium text-white transition-colors hover:bg-pinedeep disabled:opacity-50"
      >
        <HandMetal className="size-3.5" /> {pending ? "Claiming…" : "Claim"}
      </button>
    </div>
  );
}

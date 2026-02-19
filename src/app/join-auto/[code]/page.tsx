"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function JoinAutoPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function joinOrg() {
      const res = await fetch("/api/organizations/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: code }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to join organization");
        return;
      }

      router.replace(`/org/${data.orgId}`);
    }

    joinOrg();
  }, [code, router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-8 text-center">
          <p className="mb-4 text-red-400">{error}</p>
          <a
            href="/dashboard"
            className="text-sm text-blue-400 hover:underline"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900">
      <div className="text-slate-400">Joining organization...</div>
    </div>
  );
}

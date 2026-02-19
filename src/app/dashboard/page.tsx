"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/db/supabase-browser";
import type { User } from "@supabase/supabase-js";

interface OrgSummary {
  id: string;
  name: string;
  inviteCode: string;
  totalBudget: number;
  createdAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createBudget, setCreateBudget] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u));

    fetch("/api/organizations")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setOrgs(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/");
  };

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setError("");
    const res = await fetch("/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: createName.trim(), budget: Number(createBudget) || 0 }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create organization");
      return;
    }
    const { id } = await res.json();
    router.push(`/org/${id}`);
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setError("");
    const res = await fetch("/api/organizations/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: joinCode.trim().toUpperCase() }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to join organization");
      return;
    }
    const { orgId } = await res.json();
    router.push(`/org/${orgId}`);
  };

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? "";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-12">
        <div />
        <div className="flex items-center gap-3">
          <span className="text-3xl">🏘️</span>
          <h1 className="text-3xl font-bold">AgentFloor</h1>
        </div>
        <div className="flex items-center gap-3">
          {displayName && (
            <span className="text-sm text-slate-400">{displayName}</span>
          )}
          <button
            onClick={handleSignOut}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6">
        {/* Your Organizations */}
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold text-slate-300">Your Organizations</h2>
          {loading ? (
            <p className="text-slate-500">Loading...</p>
          ) : orgs.length === 0 ? (
            <p className="text-slate-500">No organizations yet. Create one or join with an invite code.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {orgs.map((org) => (
                <button
                  key={org.id}
                  onClick={() => router.push(`/org/${org.id}`)}
                  className="rounded-xl border border-slate-700 bg-slate-900 p-5 text-left transition-colors hover:border-blue-500 hover:bg-slate-800"
                >
                  <h3 className="text-lg font-semibold">{org.name}</h3>
                  <div className="mt-2 flex items-center gap-3 text-sm text-slate-400">
                    <span>Code: <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-slate-300">{org.inviteCode}</code></span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Actions */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => { setShowCreate(true); setShowJoin(false); setError(""); }}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium hover:bg-blue-500"
          >
            Create New Organization
          </button>
          <button
            onClick={() => { setShowJoin(true); setShowCreate(false); setError(""); }}
            className="rounded-lg border border-slate-600 px-5 py-2.5 text-sm font-medium hover:bg-slate-800"
          >
            Join with Invite Code
          </button>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-400">{error}</p>
        )}

        {/* Create Form */}
        {showCreate && (
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
            <h3 className="mb-4 text-lg font-semibold">Create Organization</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Organization name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                autoFocus
              />
              <input
                type="number"
                placeholder="Monthly budget (optional)"
                value={createBudget}
                onChange={(e) => setCreateBudget(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                min={0}
              />
              <div className="flex gap-3">
                <button
                  onClick={handleCreate}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium hover:bg-blue-500"
                >
                  Create
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg px-5 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Join Form */}
        {showJoin && (
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
            <h3 className="mb-4 text-lg font-semibold">Join Organization</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Invite code (e.g. ABC123)"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-mono uppercase placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                maxLength={6}
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={handleJoin}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium hover:bg-blue-500"
                >
                  Join
                </button>
                <button
                  onClick={() => setShowJoin(false)}
                  className="rounded-lg px-5 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

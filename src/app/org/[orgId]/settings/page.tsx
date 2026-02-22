"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/database/DataTable";
import SubscriptionManager from "@/components/settings/SubscriptionManager";
import { useOrgId } from "@/hooks/useOrgId";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";
import { MAP_THEMES, type MapThemeId } from "@/components/spatial/MapThemes";
import { getSupabase } from "@/db/supabase";

interface Member {
  id: string;
  name: string;
  email: string | null;
  role: string;
  status: string;
  userId: string;
  isCreator: boolean;
  joinedAt: string;
  [key: string]: unknown;
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
        role === "admin"
          ? "bg-purple-500/20 text-purple-400"
          : "bg-slate-500/20 text-slate-400",
      )}
    >
      {role}
    </span>
  );
}

interface GitHubInstallation {
  id: string;
  installation_id: number;
  github_account_login: string;
  github_account_type: string;
  created_at: string;
}

export default function SettingsPage() {
  const orgId = useOrgId();
  const router = useRouter();
  const organization = useAppStore((s) => s.organization);
  const mapTheme = useAppStore((s) => s.mapTheme);
  const setMapTheme = useAppStore((s) => s.setMapTheme);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>("member");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteResult, setInviteResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // GitHub integration state
  const [githubInstallations, setGithubInstallations] = useState<GitHubInstallation[]>([]);
  const [githubInstallUrl, setGithubInstallUrl] = useState<string | null>(null);
  const [githubAvailable, setGithubAvailable] = useState<{ installation_id: number; account_login: string; account_type: string }[]>([]);
  const [githubLoading, setGithubLoading] = useState(true);
  const [linkingInstallation, setLinkingInstallation] = useState<number | null>(null);

  // Org settings state — initialized from store
  const [orgName, setOrgName] = useState(organization.name);
  const [orgBudget, setOrgBudget] = useState<number>(organization.totalBudget);
  const [orgVisibility, setOrgVisibility] = useState<"public" | "private">(organization.visibility ?? "private");
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgSaveResult, setOrgSaveResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // API Keys state
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [apiKeysStatus, setApiKeysStatus] = useState<{ anthropic: boolean; openai: boolean }>({ anthropic: false, openai: false });
  const [apiKeysSaving, setApiKeysSaving] = useState(false);
  const [apiKeysResult, setApiKeysResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Danger zone state
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const isAdmin = currentUserRole === "admin";

  const AdminOverlay = () => (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-slate-900/60 backdrop-blur-[1px]">
      <div className="flex items-center gap-2 rounded-full bg-slate-800/90 px-4 py-2 text-sm text-slate-300 shadow-lg">
        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
        Admin access required
      </div>
    </div>
  );

  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const membersRes = await fetch(`/api/organizations/${orgId}/members`);
    if (!membersRes.ok) return;
    const membersData = await membersRes.json();
    setMembers(membersData.members);
    setCurrentUserRole(membersData.currentUserRole);
    setInviteCode(membersData.inviteCode);
    setCurrentMemberId(membersData.currentMemberId ?? null);

    setLoading(false);
  }, [orgId]);

  const fetchGitHub = useCallback(async () => {
    setGithubLoading(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}/github`);
      if (res.ok) {
        const data = await res.json();
        setGithubInstallations(data.installations ?? []);
        setGithubInstallUrl(data.installUrl ?? null);
        setGithubAvailable(data.availableInstallations ?? []);
      }
    } finally {
      setGithubLoading(false);
    }
  }, [orgId]);

  const fetchApiKeys = useCallback(async () => {
    try {
      const res = await fetch(`/api/organizations/${orgId}/api-keys`);
      if (res.ok) {
        const data = await res.json();
        setApiKeysStatus(data.orgKeys ?? { anthropic: false, openai: false });
      }
    } catch { /* ignore */ }
  }, [orgId]);

  useEffect(() => {
    fetchData();
    fetchGitHub();
    fetchApiKeys();
  }, [fetchData, fetchGitHub, fetchApiKeys]);

  const handleDisconnectGitHub = async (id: string) => {
    if (!confirm("Disconnect this GitHub account? You can reconnect later.")) return;
    const res = await fetch(`/api/organizations/${orgId}/github`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ installationId: id }),
    });
    if (res.ok) {
      fetchGitHub();
    }
  };

  const handleLinkInstallation = async (installationId: number) => {
    setLinkingInstallation(installationId);
    try {
      const res = await fetch(`/api/organizations/${orgId}/github`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installationId }),
      });
      if (res.ok) {
        fetchGitHub();
      }
    } finally {
      setLinkingInstallation(null);
    }
  };

  const handleCopyCode = async () => {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviteSending(true);
    setInviteResult(null);

    const res = await fetch(`/api/organizations/${orgId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail.trim() }),
    });

    if (!res.ok) {
      const err = await res.json();
      setInviteResult({ type: "error", message: err.error ?? "Failed to send invite" });
    } else {
      setInviteResult({ type: "success", message: `Invite sent to ${inviteEmail.trim()}` });
      setInviteEmail("");
    }

    setInviteSending(false);
  };

  const handleRegenerateCode = async () => {
    if (!confirm("Regenerate invite code? The current code will stop working."))
      return;
    const res = await fetch(`/api/organizations/${orgId}/invite-code`, {
      method: "POST",
    });
    if (!res.ok) return;
    const data = await res.json();
    setInviteCode(data.inviteCode);
  };

  const handleRoleChange = async (memberId: string, role: string) => {
    const res = await fetch(
      `/api/organizations/${orgId}/members/${memberId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      },
    );
    if (!res.ok) {
      const err = await res.json();
      alert(err.error ?? "Failed to update role");
      return;
    }
    fetchData();
  };

  const handleRemove = async (memberId: string, name: string) => {
    if (!confirm(`Remove "${name}" from this organization?`)) return;
    const res = await fetch(
      `/api/organizations/${orgId}/members/${memberId}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const err = await res.json();
      alert(err.error ?? "Failed to remove member");
      return;
    }
    fetchData();
  };

  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrgSaving(true);
    setOrgSaveResult(null);

    const res = await fetch(`/api/organizations/${orgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: orgName, totalBudget: orgBudget, visibility: orgVisibility }),
    });

    if (!res.ok) {
      const err = await res.json();
      setOrgSaveResult({ type: "error", message: err.error ?? "Failed to save" });
    } else {
      setOrgSaveResult({ type: "success", message: "Organization settings saved." });
    }

    setOrgSaving(false);
  };

  const handleSaveApiKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiKeysSaving(true);
    setApiKeysResult(null);

    const payload: Record<string, string | null> = {};
    if (anthropicKey) payload.anthropicApiKey = anthropicKey;
    if (openaiKey) payload.openaiApiKey = openaiKey;

    if (Object.keys(payload).length === 0) {
      setApiKeysResult({ type: "error", message: "Enter at least one API key." });
      setApiKeysSaving(false);
      return;
    }

    const res = await fetch(`/api/organizations/${orgId}/api-keys`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      setApiKeysResult({ type: "error", message: err.error ?? "Failed to save" });
    } else {
      setApiKeysResult({ type: "success", message: "API keys saved." });
      setAnthropicKey("");
      setOpenaiKey("");
      fetchApiKeys();
    }
    setApiKeysSaving(false);
  };

  const handleClearApiKey = async (vendor: "anthropic" | "openai") => {
    const payload = vendor === "anthropic"
      ? { anthropicApiKey: null }
      : { openaiApiKey: null };

    const res = await fetch(`/api/organizations/${orgId}/api-keys`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      fetchApiKeys();
    }
  };

  const handleDeleteOrg = async () => {
    if (deleteConfirmText !== orgName) return;
    if (!confirm(`This will permanently delete "${orgName}" and all its data. Are you sure?`)) return;

    setDeleteLoading(true);
    const res = await fetch(`/api/organizations/${orgId}`, { method: "DELETE" });

    if (!res.ok) {
      const err = await res.json();
      alert(err.error ?? "Failed to delete organization");
      setDeleteLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  const columns = [
    { key: "name", label: "Name" },
    {
      key: "email",
      label: "Email",
      render: (row: Member) => (
        <span className="text-slate-400">{row.email ?? "—"}</span>
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (row: Member) => {
        if (isAdmin && !row.isCreator) {
          return (
            <select
              value={row.role}
              onChange={(e) => {
                e.stopPropagation();
                handleRoleChange(row.id, e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
              className="rounded border border-slate-600 bg-transparent px-1 py-0.5 text-xs text-white focus:outline-none"
            >
              <option value="admin">admin</option>
              <option value="member">member</option>
            </select>
          );
        }
        return <RoleBadge role={row.role} />;
      },
    },
    {
      key: "joinedAt",
      label: "Joined",
      render: (row: Member) => {
        const d = new Date(row.joinedAt);
        return d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      },
    },
    ...(isAdmin
      ? [
          {
            key: "_actions" as const,
            label: "",
            sortable: false,
            render: (row: Member) => {
              if (row.isCreator) return null;
              return (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(row.id, row.name);
                  }}
                  className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/20"
                >
                  Remove
                </button>
              );
            },
          },
        ]
      : []),
  ];

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-slate-400">Loading settings...</div>
      </div>
    );
  }

  /* ── Shared card style tokens ── */
  const card = "rounded-lg border border-slate-700/80 bg-slate-900 shadow-sm";
  const cardHeader = "flex items-center gap-3 border-b border-slate-700/60 px-5 py-4";
  const cardBody = "px-5 py-5";
  const sectionIcon = "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-800 text-slate-400";
  const inputBase = "rounded-md border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 transition-colors focus:border-amber-500/60 focus:outline-none focus:ring-1 focus:ring-amber-500/30 disabled:opacity-50";
  const btnPrimary = "rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-500 disabled:opacity-50";
  const btnSecondary = "rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-750 hover:text-white disabled:opacity-50";
  const labelText = "text-xs font-medium uppercase tracking-wide text-slate-400";
  const descText = "text-sm leading-relaxed text-slate-400";

  return (
    <div className="mx-auto max-w-5xl p-6 pb-20 min-h-screen bg-slate-950">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your organization, integrations, and team.</p>
      </div>

      {/* ═══════ GENERAL section ═══════ */}
      <div className="mb-10">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">General</h2>

        {/* Organization + Invite Code — 2-column */}
        <div className="grid gap-5 lg:grid-cols-5">
          {/* Organization — 3 cols */}
          <div className={cn(card, "relative lg:col-span-3")}>
            {!isAdmin && <AdminOverlay />}
            <div className={cardHeader}>
              <div className={sectionIcon}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Organization</h3>
                <p className="text-xs text-slate-500">Name, budget, and visibility</p>
              </div>
            </div>
            <div className={cardBody}>
              <form onSubmit={handleSaveOrg} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className={labelText}>Organization Name</label>
                  <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} required disabled={!isAdmin} className={cn(inputBase, "max-w-sm")} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelText}>Monthly Budget (USD)</label>
                  <input type="number" min={0} step={0.01} value={orgBudget} onChange={(e) => setOrgBudget(parseFloat(e.target.value))} required disabled={!isAdmin} className={cn(inputBase, "w-44")} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelText}>Visibility</label>
                  <div className="flex gap-2">
                    {(["private", "public"] as const).map((v) => (
                      <button key={v} type="button" onClick={() => setOrgVisibility(v)} disabled={!isAdmin}
                        className={cn("rounded-md border px-4 py-2 text-sm font-medium capitalize transition-colors",
                          orgVisibility === v ? "border-amber-500/50 bg-amber-500/10 text-amber-300" : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600")} >
                        {v}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">
                    {orgVisibility === "private" ? "Only invited members can see this organization." : "Anyone can discover this organization."}
                  </p>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <button type="submit" disabled={orgSaving || !isAdmin} className={btnPrimary}>
                    {orgSaving ? "Saving..." : "Save Changes"}
                  </button>
                  {orgSaveResult && (
                    <p className={cn("text-sm", orgSaveResult.type === "success" ? "text-emerald-400" : "text-red-400")}>{orgSaveResult.message}</p>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Invite Code + Email — 2 cols */}
          <div className="flex flex-col gap-5 lg:col-span-2">
            {/* Invite Code */}
            <div className={cn(card, "relative flex-1")}>
              {!isAdmin && <AdminOverlay />}
              <div className={cardHeader}>
                <div className={sectionIcon}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" /></svg>
                </div>
                <h3 className="text-sm font-semibold text-slate-200">Invite Code</h3>
              </div>
              <div className={cardBody}>
                <p className={cn(descText, "mb-3")}>Share this code with teammates.</p>
                <div className="mb-3 flex items-center gap-2">
                  <code className="rounded-md border border-slate-700 bg-slate-800 px-4 py-2 font-mono text-lg tracking-[0.25em] text-amber-300">
                    {inviteCode ?? "------"}
                  </code>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCopyCode} disabled={!isAdmin} className={btnSecondary}>
                    {copied ? "Copied!" : "Copy"}
                  </button>
                  <button onClick={handleRegenerateCode} disabled={!isAdmin} className={btnSecondary}>
                    Regenerate
                  </button>
                </div>
              </div>
            </div>

            {/* Invite by Email */}
            <div className={cn(card, "relative flex-1")}>
              {!isAdmin && <AdminOverlay />}
              <div className={cardHeader}>
                <div className={sectionIcon}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" /></svg>
                </div>
                <h3 className="text-sm font-semibold text-slate-200">Invite by Email</h3>
              </div>
              <div className={cardBody}>
                <p className={cn(descText, "mb-3")}>Send a magic link invitation.</p>
                <form onSubmit={handleSendInvite} className="flex flex-col gap-2">
                  <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@example.com" required disabled={!isAdmin} className={cn(inputBase, "w-full")} />
                  <button type="submit" disabled={inviteSending || !isAdmin} className={btnPrimary}>
                    {inviteSending ? "Sending..." : "Send Invite"}
                  </button>
                </form>
                {inviteResult && (
                  <p className={cn("mt-2 text-sm", inviteResult.type === "success" ? "text-emerald-400" : "text-red-400")}>{inviteResult.message}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ INTEGRATIONS section ═══════ */}
      <div className="mb-10">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Integrations</h2>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* API Keys */}
          <div className={card}>
            <div className={cardHeader}>
              <div className={sectionIcon}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0 1 19.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 0 0 4.5 10.5a48.667 48.667 0 0 0-1.26 8.25m17.745-4.5a7.5 7.5 0 0 0-7.5-7.5H12a48.667 48.667 0 0 0 0 15m0 0h.375a7.5 7.5 0 0 0 7.125-5.25" /></svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-200">API Keys</h3>
                <p className="text-xs text-slate-500">For Chat feature</p>
              </div>
            </div>
            <div className={cardBody}>
              {/* Status indicators */}
              <div className="mb-4 flex gap-4">
                {(["anthropic", "openai"] as const).map((vendor) => (
                  <div key={vendor} className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", apiKeysStatus[vendor] ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]" : "bg-slate-600")} />
                    <span className="text-sm capitalize text-slate-300">{vendor}</span>
                    {apiKeysStatus[vendor] && (
                      <button onClick={() => handleClearApiKey(vendor)} className="text-xs text-red-400 transition-colors hover:text-red-300">Clear</button>
                    )}
                  </div>
                ))}
              </div>
              <form onSubmit={handleSaveApiKeys} className="space-y-3">
                <div className="flex flex-col gap-1.5">
                  <label className={labelText}>Anthropic API Key</label>
                  <input type="password" value={anthropicKey} onChange={(e) => setAnthropicKey(e.target.value)} placeholder={apiKeysStatus.anthropic ? "already set" : "sk-ant-..."} className={cn(inputBase, "w-full")} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelText}>OpenAI API Key</label>
                  <input type="password" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} placeholder={apiKeysStatus.openai ? "already set" : "sk-..."} className={cn(inputBase, "w-full")} />
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <button type="submit" disabled={apiKeysSaving || (!anthropicKey && !openaiKey)} className={btnPrimary}>
                    {apiKeysSaving ? "Saving..." : "Save API Keys"}
                  </button>
                  {apiKeysResult && (
                    <p className={cn("text-sm", apiKeysResult.type === "success" ? "text-emerald-400" : "text-red-400")}>{apiKeysResult.message}</p>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* GitHub Integration */}
          <div className={cn(card, "relative")}>
            {!isAdmin && <AdminOverlay />}
            <div className={cardHeader}>
              <div className={sectionIcon}>
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-200">GitHub</h3>
                <p className="text-xs text-slate-500">Private repo access for agents</p>
              </div>
            </div>
            <div className={cardBody}>
              {githubLoading ? (
                <p className="text-sm text-slate-500">Loading...</p>
              ) : (
                <>
                  {githubInstallations.length > 0 && (
                    <div className="mb-4 space-y-2">
                      {githubInstallations.map((inst) => (
                        <div key={inst.id} className="flex items-center justify-between rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <svg className="h-4 w-4 text-slate-400" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
                            <span className="text-sm font-medium text-slate-200">{inst.github_account_login}</span>
                            <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-xs text-slate-400">{inst.github_account_type}</span>
                          </div>
                          <button onClick={() => handleDisconnectGitHub(inst.id)} className="rounded-md px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-500/10">Disconnect</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {githubAvailable.length > 0 && (
                    <div className="mb-3">
                      <p className="mb-2 text-xs text-slate-500">Available to link:</p>
                      <div className="space-y-2">
                        {githubAvailable.map((inst) => (
                          <div key={inst.installation_id} className="flex items-center justify-between rounded-md border border-dashed border-slate-700 px-3 py-2">
                            <div className="flex items-center gap-2">
                              <svg className="h-4 w-4 text-slate-500" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
                              <span className="text-sm text-slate-300">{inst.account_login}</span>
                              <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-xs text-slate-500">{inst.account_type}</span>
                            </div>
                            <button onClick={() => handleLinkInstallation(inst.installation_id)} disabled={linkingInstallation === inst.installation_id} className={btnPrimary}>
                              {linkingInstallation === inst.installation_id ? "Linking..." : "Link"}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {githubInstallUrl && (
                    <a href={githubInstallUrl} className={cn(btnSecondary, "inline-flex items-center gap-2")}>
                      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
                      {githubInstallations.length > 0 ? "Connect Another Account" : "Connect GitHub"}
                    </a>
                  )}

                  {!githubInstallUrl && githubInstallations.length === 0 && (
                    <p className="text-xs text-slate-500">GitHub App not configured. Set GITHUB_APP_CLIENT_ID in env.</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ PREFERENCES section ═══════ */}
      <div className="mb-10">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Preferences</h2>

        {/* Map Theme */}
        <div className={cn(card, "mb-5")}>
          <div className={cardHeader}>
            <div className={sectionIcon}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" /></svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Map Theme</h3>
              <p className="text-xs text-slate-500">Visual theme for the spatial map</p>
            </div>
          </div>
          <div className={cardBody}>
            <div className="flex flex-wrap gap-3">
              {MAP_THEMES.map((theme) => {
                const selected = mapTheme === theme.id;
                const swatches = [
                  theme.grass[0], theme.grass[1], theme.grass[2], theme.dirt,
                  theme.water[0], theme.treeTrunk, theme.treeLeaves, theme.stoneColor,
                  theme.bushColor, theme.flowerColors[0], theme.campfireFlames[1], theme.waterWave,
                ];
                return (
                  <button key={theme.id} onClick={() => setMapTheme(theme.id as MapThemeId)}
                    className={cn("flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all",
                      selected ? "border-amber-500/60 bg-amber-500/5 shadow-[0_0_12px_rgba(217,119,6,0.1)]" : "border-slate-700 bg-slate-800/60 hover:border-slate-600")} >
                    <div className="grid grid-cols-4 gap-1">
                      {swatches.map((color, i) => (
                        <div key={i} className="h-3.5 w-3.5 rounded-sm" style={{ backgroundColor: `#${color.toString(16).padStart(6, "0")}` }} />
                      ))}
                    </div>
                    <span className={cn("text-xs font-medium", selected ? "text-amber-300" : "text-slate-300")}>{theme.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Subscriptions */}
        <div className={card}>
          <div className={cardHeader}>
            <div className={sectionIcon}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" /></svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200">My Subscriptions</h3>
              <p className="text-xs text-slate-500">AI service subscriptions</p>
            </div>
          </div>
          <div className={cardBody}>
            <SubscriptionManager orgId={orgId} memberId={currentMemberId} isAdmin={isAdmin} />
          </div>
        </div>
      </div>

      {/* ═══════ TEAM section ═══════ */}
      <div className="mb-10">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Team</h2>
        <div className={card}>
          <div className={cardHeader}>
            <div className={sectionIcon}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>
            </div>
            <h3 className="text-sm font-semibold text-slate-200">Members ({members.length})</h3>
          </div>
          <div className="p-0">
            <DataTable
              columns={columns}
              data={members}
              searchPlaceholder="Search members..."
              searchKeys={["name", "email", "role"]}
            />
          </div>
        </div>
      </div>

      {/* ═══════ ACCOUNT section ═══════ */}
      <div className="mb-10">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Account</h2>
        <div className={cn(card, "flex items-center justify-between px-5 py-4")}>
          <div className="flex items-center gap-3">
            <div className={sectionIcon}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15m-3 0-3-3m0 0 3-3m-3 3H15" /></svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Sign Out</h3>
              <p className="text-xs text-slate-500">Log out of AgentFactorio on this device</p>
            </div>
          </div>
          <button
            onClick={async () => {
              const supabase = getSupabase();
              await supabase.auth.signOut();
              router.push("/");
            }}
            className={btnSecondary}
          >
            Log Out
          </button>
        </div>
      </div>

      {/* ═══════ DANGER ZONE ═══════ */}
      {isAdmin && (
        <div className="mb-10">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-red-500/80">Danger Zone</h2>
          <div className="rounded-lg border border-red-900/40 bg-red-950/10 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-red-950/50 text-red-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-400">Delete Organization</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Permanently remove this organization and all data. This cannot be undone.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <label className="text-xs font-medium text-slate-400">
                    Type <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-slate-300">{orgName}</code> to confirm
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder={orgName}
                    className={cn(inputBase, "max-w-sm border-red-900/40 focus:border-red-500/60 focus:ring-red-500/30")}
                  />
                  <div>
                    <button
                      onClick={handleDeleteOrg}
                      disabled={deleteConfirmText !== orgName || deleteLoading}
                      className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {deleteLoading ? "Deleting..." : "Delete Organization"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

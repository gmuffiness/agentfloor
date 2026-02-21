"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/database/DataTable";
import SubscriptionManager from "@/components/settings/SubscriptionManager";
import { useOrgId } from "@/hooks/useOrgId";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";
import { MAP_THEMES, type MapThemeId } from "@/components/spatial/MapThemes";

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
        setApiKeysStatus(await res.json());
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

  return (
    <div className="mx-auto max-w-7xl p-6">
      <h1 className="mb-6 text-2xl font-bold text-white">Settings</h1>

      {/* Organization Card */}
      <div className="relative mb-8 rounded-lg border border-slate-700 bg-slate-800/50 p-6">
        {!isAdmin && <AdminOverlay />}
        <h2 className="mb-1 text-lg font-semibold text-white">Organization</h2>
        <p className="mb-4 text-sm text-slate-300">
          Update your organization name and monthly budget limit.
        </p>
        <form onSubmit={handleSaveOrg} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-300">Organization Name</label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
              disabled={!isAdmin}
              className="w-80 rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-300">Monthly Budget (USD)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={orgBudget}
              onChange={(e) => setOrgBudget(parseFloat(e.target.value))}
              required
              disabled={!isAdmin}
              className="w-48 rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-300">Visibility</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setOrgVisibility("private")}
                disabled={!isAdmin}
                className={cn(
                  "rounded border px-4 py-2 text-sm font-medium transition-colors",
                  orgVisibility === "private"
                    ? "border-blue-500 bg-blue-500/10 text-blue-300"
                    : "border-slate-600 bg-slate-900 text-slate-400 hover:border-slate-500",
                )}
              >
                Private
              </button>
              <button
                type="button"
                onClick={() => setOrgVisibility("public")}
                disabled={!isAdmin}
                className={cn(
                  "rounded border px-4 py-2 text-sm font-medium transition-colors",
                  orgVisibility === "public"
                    ? "border-blue-500 bg-blue-500/10 text-blue-300"
                    : "border-slate-600 bg-slate-900 text-slate-400 hover:border-slate-500",
                )}
              >
                Public
              </button>
            </div>
            <p className="text-xs text-slate-400">
              {orgVisibility === "private"
                ? "Only invited members can see this organization."
                : "Anyone can discover this organization."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={orgSaving || !isAdmin}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {orgSaving ? "Saving..." : "Save Changes"}
            </button>
            {orgSaveResult && (
              <p
                className={cn(
                  "text-sm",
                  orgSaveResult.type === "success" ? "text-green-400" : "text-red-400",
                )}
              >
                {orgSaveResult.message}
              </p>
            )}
          </div>
        </form>
      </div>

      {/* API Keys Card */}
      <div className="mb-8 overflow-hidden rounded border border-slate-700">
        <div className="bg-slate-800 px-4 py-3">
          <h2 className="text-sm font-medium text-slate-300">API Keys</h2>
        </div>
        <div className="bg-slate-900 p-6">
        <p className="mb-4 text-sm text-white">
          Set vendor API keys for this organization. These keys are used for the Chat feature. Keys are stored securely and never exposed to the client.
        </p>

        {/* Current status */}
        <div className="mb-4 flex gap-4">
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", apiKeysStatus.anthropic ? "bg-green-400" : "bg-slate-600")} />
            <span className="text-sm text-white">Anthropic</span>
            {apiKeysStatus.anthropic && (
              <button onClick={() => handleClearApiKey("anthropic")} className="text-xs text-red-400 hover:text-red-300">Clear</button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", apiKeysStatus.openai ? "bg-green-400" : "bg-slate-600")} />
            <span className="text-sm text-white">OpenAI</span>
            {apiKeysStatus.openai && (
              <button onClick={() => handleClearApiKey("openai")} className="text-xs text-red-400 hover:text-red-300">Clear</button>
            )}
          </div>
        </div>

        <form onSubmit={handleSaveApiKeys} className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-300">Anthropic API Key</label>
            <input
              type="password"
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              placeholder={apiKeysStatus.anthropic ? "••••••••••••••• (already set)" : "sk-ant-..."}
              className="w-96 rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-300">OpenAI API Key</label>
            <input
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder={apiKeysStatus.openai ? "••••••••••••••• (already set)" : "sk-..."}
              className="w-96 rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={apiKeysSaving || (!anthropicKey && !openaiKey)}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {apiKeysSaving ? "Saving..." : "Save API Keys"}
            </button>
            {apiKeysResult && (
              <p className={cn("text-sm", apiKeysResult.type === "success" ? "text-green-400" : "text-red-400")}>
                {apiKeysResult.message}
              </p>
            )}
          </div>
        </form>
        </div>
      </div>

      {/* Invite Code Card */}
      <div className="relative mb-8 rounded-lg border border-slate-700 bg-slate-800/50 p-6">
        {!isAdmin && <AdminOverlay />}
        <h2 className="mb-1 text-lg font-semibold text-white">
          Invite Code
        </h2>
        <p className="mb-4 text-sm text-slate-300">
          Share this code with teammates to let them join your organization.
        </p>
        <div className="flex items-center gap-3">
          <code className="rounded bg-slate-900 px-4 py-2 font-mono text-lg tracking-widest text-white">
            {inviteCode ?? "••••••"}
          </code>
          <button
            onClick={handleCopyCode}
            disabled={!isAdmin}
            className="rounded bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-600 disabled:opacity-50"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={handleRegenerateCode}
            disabled={!isAdmin}
            className="rounded bg-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-600 hover:text-white disabled:opacity-50"
          >
            Regenerate
          </button>
        </div>
      </div>

      {/* Invite by Email */}
      <div className="relative mb-8 rounded-lg border border-slate-700 bg-slate-800/50 p-6">
        {!isAdmin && <AdminOverlay />}
        <h2 className="mb-1 text-lg font-semibold text-white">
          Invite by Email
        </h2>
        <p className="mb-4 text-sm text-slate-300">
          Send an email invitation with a magic link. The recipient will be
          automatically added to this organization.
        </p>
        <form onSubmit={handleSendInvite} className="flex items-center gap-3">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@example.com"
            required
            disabled={!isAdmin}
            className="w-72 rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={inviteSending || !isAdmin}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {inviteSending ? "Sending..." : "Send Invite"}
          </button>
        </form>
        {inviteResult && (
          <p
            className={cn(
              "mt-3 text-sm",
              inviteResult.type === "success"
                ? "text-green-400"
                : "text-red-400",
            )}
          >
            {inviteResult.message}
          </p>
        )}
      </div>

      {/* GitHub Integration */}
      <div className="relative mb-8 rounded-lg border border-slate-700 bg-slate-800/50 p-6">
        {!isAdmin && <AdminOverlay />}
          <h2 className="mb-1 text-lg font-semibold text-white">GitHub Integration</h2>
          <p className="mb-4 text-sm text-slate-300">
            Connect a GitHub account to allow cloud-runtime agents to access private repositories.
          </p>

          {githubLoading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : (
            <>
              {githubInstallations.length > 0 && (
                <div className="mb-4 space-y-3">
                  {githubInstallations.map((inst) => (
                    <div
                      key={inst.id}
                      className="flex items-center justify-between rounded border border-slate-600 bg-slate-900 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <svg className="h-5 w-5 text-slate-300" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                        </svg>
                        <div>
                          <span className="font-medium text-white">{inst.github_account_login}</span>
                          <span className="ml-2 rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
                            {inst.github_account_type}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDisconnectGitHub(inst.id)}
                        className="rounded px-3 py-1 text-sm text-red-400 hover:bg-red-500/20"
                      >
                        Disconnect
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {githubAvailable.length > 0 && (
                <div className="mb-3">
                  <p className="mb-2 text-sm text-slate-400">
                    The following GitHub accounts have the App installed but are not linked to this organization:
                  </p>
                  <div className="space-y-2">
                    {githubAvailable.map((inst) => (
                      <div key={inst.installation_id} className="flex items-center justify-between rounded border border-dashed border-slate-600 px-4 py-2">
                        <div className="flex items-center gap-3">
                          <svg className="h-5 w-5 text-slate-400" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                          </svg>
                          <div>
                            <span className="font-medium text-white">{inst.account_login}</span>
                            <span className="ml-2 rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
                              {inst.account_type}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleLinkInstallation(inst.installation_id)}
                          disabled={linkingInstallation === inst.installation_id}
                          className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                        >
                          {linkingInstallation === inst.installation_id ? "Linking..." : "Link"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {githubInstallUrl && (
                <a
                  href={githubInstallUrl}
                  className="inline-flex items-center gap-2 rounded bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600"
                >
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                  </svg>
                  {githubInstallations.length > 0 ? "Connect Another Account" : "Connect GitHub"}
                </a>
              )}

              {!githubInstallUrl && githubInstallations.length === 0 && (
                <p className="text-sm text-slate-500">
                  GitHub App is not configured. Set GITHUB_APP_CLIENT_ID in environment variables.
                </p>
              )}
            </>
          )}
        </div>

      {/* Map Theme */}
      <div className="mb-8 overflow-hidden rounded border border-slate-700">
        <div className="bg-slate-800 px-4 py-3">
          <h2 className="text-sm font-medium text-slate-300">Map Theme</h2>
        </div>
        <div className="bg-slate-900 p-6">
          <p className="mb-4 text-sm text-white">
            Choose the visual theme for the spatial map. Changes apply instantly.
          </p>
          <div className="flex gap-4">
            {MAP_THEMES.map((theme) => {
              const selected = mapTheme === theme.id;
              const swatches = [
                theme.grass[0], theme.grass[1], theme.grass[2],
                theme.dirt,
                theme.water[0], theme.treeTrunk,
                theme.treeLeaves, theme.stoneColor,
                theme.bushColor, theme.flowerColors[0],
                theme.campfireFlames[1], theme.waterWave,
              ];
              return (
                <button
                  key={theme.id}
                  onClick={() => setMapTheme(theme.id as MapThemeId)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors",
                    selected
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-slate-600 bg-slate-800 hover:border-slate-500",
                  )}
                >
                  <div className="grid grid-cols-4 gap-1">
                    {swatches.map((color, i) => (
                      <div
                        key={i}
                        className="h-4 w-4 rounded-sm"
                        style={{ backgroundColor: `#${color.toString(16).padStart(6, "0")}` }}
                      />
                    ))}
                  </div>
                  <span className={cn("text-sm font-medium", selected ? "text-blue-300" : "text-white")}>
                    {theme.name}
                  </span>
                  <span className="text-xs text-slate-400">{theme.description}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* My Subscriptions */}
      <div className="mb-8 overflow-hidden rounded border border-slate-700">
        <div className="bg-slate-800 px-4 py-3">
          <h2 className="text-sm font-medium text-slate-300">My Subscriptions</h2>
        </div>
        <div className="bg-slate-900 p-6">
          <p className="mb-4 text-sm text-white">
            Manage your AI service subscriptions. Auto-detected services from CLI push will appear here.
          </p>
          <SubscriptionManager orgId={orgId} memberId={currentMemberId} isAdmin={isAdmin} />
        </div>
      </div>

      {/* Members Table */}
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Members ({members.length})
          </h2>
        </div>
        <DataTable
          columns={columns}
          data={members}
          searchPlaceholder="Search members..."
          searchKeys={["name", "email", "role"]}
        />
      </div>

      {/* Danger Zone */}
      {isAdmin && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-6">
          <h2 className="mb-1 text-lg font-semibold text-red-400">Danger Zone</h2>
          <p className="mb-4 text-sm text-slate-300">
            Permanently delete this organization and all its data including departments, agents, and cost history. This action cannot be undone.
          </p>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-300">
                Type <span className="font-mono text-slate-300">{orgName}</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={orgName}
                className="w-80 rounded border border-red-900/50 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-red-500 focus:outline-none"
              />
            </div>
            <div>
              <button
                onClick={handleDeleteOrg}
                disabled={deleteConfirmText !== orgName || deleteLoading}
                className="rounded bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleteLoading ? "Deleting..." : "Delete Organization"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

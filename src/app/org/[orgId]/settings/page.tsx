"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/database/DataTable";
import { useOrgId } from "@/hooks/useOrgId";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";

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

export default function SettingsPage() {
  const orgId = useOrgId();
  const router = useRouter();
  const organization = useAppStore((s) => s.organization);
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

  // Org settings state — initialized from store
  const [orgName, setOrgName] = useState(organization.name);
  const [orgBudget, setOrgBudget] = useState<number>(organization.totalBudget);
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgSaveResult, setOrgSaveResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Danger zone state
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const isAdmin = currentUserRole === "admin";

  const fetchData = useCallback(async () => {
    const membersRes = await fetch(`/api/organizations/${orgId}/members`);
    if (!membersRes.ok) return;
    const membersData = await membersRes.json();
    setMembers(membersData.members);
    setCurrentUserRole(membersData.currentUserRole);
    setInviteCode(membersData.inviteCode);

    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      body: JSON.stringify({ name: orgName, totalBudget: orgBudget }),
    });

    if (!res.ok) {
      const err = await res.json();
      setOrgSaveResult({ type: "error", message: err.error ?? "Failed to save" });
    } else {
      setOrgSaveResult({ type: "success", message: "Organization settings saved." });
    }

    setOrgSaving(false);
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
      {isAdmin && (
        <div className="mb-8 rounded-lg border border-slate-700 bg-slate-800/50 p-6">
          <h2 className="mb-1 text-lg font-semibold text-white">Organization</h2>
          <p className="mb-4 text-sm text-slate-400">
            Update your organization name and monthly budget limit.
          </p>
          <form onSubmit={handleSaveOrg} className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-400">Organization Name</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                className="w-80 rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-400">Monthly Budget (USD)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={orgBudget}
                onChange={(e) => setOrgBudget(parseFloat(e.target.value))}
                required
                className="w-48 rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={orgSaving}
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
      )}

      {/* Invite Code Card */}
      {isAdmin && inviteCode && (
        <div className="mb-8 rounded-lg border border-slate-700 bg-slate-800/50 p-6">
          <h2 className="mb-1 text-lg font-semibold text-white">
            Invite Code
          </h2>
          <p className="mb-4 text-sm text-slate-400">
            Share this code with teammates to let them join your organization.
          </p>
          <div className="flex items-center gap-3">
            <code className="rounded bg-slate-900 px-4 py-2 font-mono text-lg tracking-widest text-white">
              {inviteCode}
            </code>
            <button
              onClick={handleCopyCode}
              className="rounded bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-600"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={handleRegenerateCode}
              className="rounded bg-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-600 hover:text-white"
            >
              Regenerate
            </button>
          </div>
        </div>
      )}

      {/* Invite by Email */}
      {isAdmin && (
        <div className="mb-8 rounded-lg border border-slate-700 bg-slate-800/50 p-6">
          <h2 className="mb-1 text-lg font-semibold text-white">
            Invite by Email
          </h2>
          <p className="mb-4 text-sm text-slate-400">
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
              className="w-72 rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={inviteSending}
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
      )}

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
          <p className="mb-4 text-sm text-slate-400">
            Permanently delete this organization and all its data including departments, agents, and cost history. This action cannot be undone.
          </p>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-400">
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

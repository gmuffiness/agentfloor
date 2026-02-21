"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable } from "@/components/database/DataTable";
import { AgentForm, type AgentFormData } from "@/components/database/AgentForm";
import { useAppStore } from "@/stores/app-store";
import { useOrgId } from "@/hooks/useOrgId";
import { formatCurrency } from "@/lib/utils";
import type { Vendor, AgentStatus } from "@/types";

interface AgentRow {
  id: string;
  name: string;
  departmentName: string;
  deptId: string;
  humanId: string | null;
  humanName: string;
  registeredByName: string;
  registeredByEmail: string;
  vendor: string;
  model: string;
  status: string;
  monthlyCost: number;
  tokensUsed: number;
  lastActive: string;
  [key: string]: unknown;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-500/20 text-green-400",
    idle: "bg-yellow-500/20 text-yellow-400",
    error: "bg-red-500/20 text-red-400",
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-slate-500/20 text-slate-400"}`}>
      {status}
    </span>
  );
}

function VendorBadge({ vendor }: { vendor: string }) {
  const colors: Record<string, string> = {
    anthropic: "bg-orange-500/20 text-orange-400",
    openai: "bg-green-500/20 text-green-400",
    google: "bg-blue-500/20 text-blue-400",
  };
  const labels: Record<string, string> = {
    anthropic: "Anthropic",
    openai: "OpenAI",
    google: "Google",
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[vendor] ?? "bg-slate-500/20 text-slate-400"}`}>
      {labels[vendor] ?? vendor}
    </span>
  );
}

export default function AgentsPage() {
  const orgId = useOrgId();
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasGitHub, setHasGitHub] = useState(false);
  const [currentMemberName, setCurrentMemberName] = useState<string | null>(null);
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const fetchOrganization = useAppStore((s) => s.fetchOrganization);

  const fetchData = useCallback(async () => {
    const [agentsRes, deptsRes, membersRes] = await Promise.all([
      fetch(`/api/organizations/${orgId}/agents`),
      fetch(`/api/organizations/${orgId}/departments`),
      fetch(`/api/organizations/${orgId}/members`),
    ]);
    setAgents(await agentsRes.json());
    const deptData = await deptsRes.json();
    setDepartments(deptData.map((d: { id: string; name: string }) => ({ id: d.id, name: d.name })));
    if (membersRes.ok) {
      const membersData = await membersRes.json();
      const memberList = (membersData.members ?? []).map((m: { id: string; name: string }) => ({ id: m.id, name: m.name }));
      setMembers(memberList);
      const curId = membersData.currentMemberId;
      const current = memberList.find((m: { id: string; name: string }) => m.id === curId);
      if (current) {
        setCurrentMemberName(current.name);
        setCurrentMemberId(current.id);
      }
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (data: AgentFormData) => {
    await fetch(`/api/organizations/${orgId}/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setShowForm(false);
    fetchData();
    fetchOrganization(orgId, true); // force refresh store cache for spatial map
  };

  const handleNameChange = async (id: string, name: string) => {
    if (!name.trim()) return;
    await fetch(`/api/organizations/${orgId}/agents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    fetchData();
    fetchOrganization(orgId, true);
  };

  const handleStatusChange = async (id: string, status: string) => {
    await fetch(`/api/organizations/${orgId}/agents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchData();
    fetchOrganization(orgId, true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete agent "${name}"?`)) return;
    await fetch(`/api/organizations/${orgId}/agents/${id}`, { method: "DELETE" });
    fetchData();
    fetchOrganization(orgId, true);
  };

  const columns = [
    {
      key: "name",
      label: "Name",
      render: (row: AgentRow) => (
        <input
          type="text"
          defaultValue={row.name}
          onBlur={(e) => {
            const val = e.target.value.trim();
            if (val && val !== row.name) handleNameChange(row.id, val);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              (e.target as HTMLInputElement).value = row.name;
              (e.target as HTMLInputElement).blur();
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-white hover:border-slate-600 focus:border-blue-500 focus:outline-none"
        />
      ),
    },
    { key: "departmentName", label: "Department" },
    {
      key: "registeredByName",
      label: "Owner",
      render: (row: AgentRow) => {
        const name = row.registeredByName || row.humanName;
        if (!name) return <span className="text-slate-500">—</span>;
        return (
          <span title={row.registeredByEmail || undefined}>
            {name}
          </span>
        );
      },
    },
    {
      key: "vendor",
      label: "Vendor",
      render: (row: AgentRow) => <VendorBadge vendor={row.vendor} />,
    },
    { key: "model", label: "Model" },
    {
      key: "status",
      label: "Status",
      render: (row: AgentRow) => (
        <select
          value={row.status}
          onChange={(e) => { e.stopPropagation(); handleStatusChange(row.id, e.target.value); }}
          onClick={(e) => e.stopPropagation()}
          className="rounded border border-slate-600 bg-transparent px-1 py-0.5 text-xs text-white focus:outline-none"
        >
          <option value="active">active</option>
          <option value="idle">idle</option>
          <option value="error">error</option>
        </select>
      ),
    },
    {
      key: "monthlyCost",
      label: "Cost/mo",
      render: (row: AgentRow) => formatCurrency(row.monthlyCost),
    },
    {
      key: "tokensUsed",
      label: "Tokens",
      render: (row: AgentRow) => {
        const t = row.tokensUsed;
        if (t >= 1_000_000) return `${(t / 1_000_000).toFixed(1)}M`;
        if (t >= 1_000) return `${(t / 1_000).toFixed(0)}K`;
        return String(t);
      },
    },
    {
      key: "lastActive",
      label: "Last Active",
      render: (row: AgentRow) => {
        const d = new Date(row.lastActive);
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
      },
    },
    {
      key: "_actions",
      label: "",
      sortable: false,
      render: (row: AgentRow) => (
        <button
          onClick={(e) => { e.stopPropagation(); handleDelete(row.id, row.name); }}
          className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/20"
        >
          Delete
        </button>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-slate-400">Loading agents...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Agents</h1>
        <button
          onClick={async () => {
            // Lazy-load GitHub status on first open
            const githubRes = await fetch(`/api/organizations/${orgId}/github`);
            if (githubRes.ok) {
              const ghData = await githubRes.json();
              setHasGitHub((ghData.installations ?? []).length > 0);
            }
            setShowForm(true);
          }}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          + Add Agent
        </button>
      </div>

      <DataTable
        columns={columns}
        data={agents}
        onRowClick={(row) => selectAgent(row.id)}
        searchPlaceholder="Search agents..."
        searchKeys={["name", "departmentName", "humanName", "registeredByName", "vendor", "model", "status"]}
      />

      {showForm && (
        <AgentForm
          departments={departments}
          members={members}
          orgId={orgId}
          hasGitHub={hasGitHub}
          defaultOwnerId={currentMemberId}
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

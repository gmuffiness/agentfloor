"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable } from "@/components/database/DataTable";
import { AgentForm, type AgentFormData, type EditAgentData } from "@/components/database/AgentForm";
import { useAppStore } from "@/stores/app-store";
import { useOrgId } from "@/hooks/useOrgId";
import { formatCurrency, getActivityGrade, getGradeBgClass } from "@/lib/utils";
import type { Vendor, AgentStatus } from "@/types";
import { trackAgentCreate, trackAgentEdit, trackAgentDelete } from "@/lib/analytics";

interface AgentRow {
  id: string;
  name: string;
  description: string;
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
  runtimeType?: string;
  gatewayUrl?: string;
  grade: string;
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

function ActivityGradeBadge({ lastActive }: { lastActive: string }) {
  const grade = getActivityGrade(lastActive);
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${getGradeBgClass(grade)}`}
      title={`Activity Grade: ${grade}`}
    >
      {grade}
    </span>
  );
}

function ReadOnlyToast({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  if (!visible) return null;
  return (
    <div className="fixed left-1/2 top-16 z-[60] -translate-x-1/2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300 shadow-lg backdrop-blur">
      <span>This is a template organization. Fork it to make changes.</span>
      <button onClick={onDismiss} className="ml-3 text-amber-400 hover:text-amber-200">&times;</button>
    </div>
  );
}

export default function AgentsPage() {
  const orgId = useOrgId();
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editAgent, setEditAgent] = useState<EditAgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasGitHub, setHasGitHub] = useState(false);
  const [currentMemberName, setCurrentMemberName] = useState<string | null>(null);
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const fetchOrganization = useAppStore((s) => s.fetchOrganization);
  const visibility = useAppStore((s) => s.organization.visibility);

  const isReadOnly = visibility === "public" && !currentMemberId;

  const showReadOnlyToast = useCallback(() => {
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  }, []);

  const fetchData = useCallback(async () => {
    const [agentsRes, deptsRes, membersRes] = await Promise.all([
      fetch(`/api/organizations/${orgId}/agents`),
      fetch(`/api/organizations/${orgId}/departments`),
      fetch(`/api/organizations/${orgId}/members`),
    ]);
    const agentsData: AgentRow[] = await agentsRes.json();
    setAgents(agentsData.map((a) => ({ ...a, grade: getActivityGrade(a.lastActive) })));
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
    trackAgentCreate(data.vendor);
    setShowForm(false);
    fetchData();
    fetchOrganization(orgId, true);
  };

  const handleEdit = async (data: AgentFormData) => {
    if (!editAgent) return;
    await fetch(`/api/organizations/${orgId}/agents/${editAgent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    trackAgentEdit();
    setEditAgent(null);
    fetchData();
    fetchOrganization(orgId, true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete agent "${name}"?`)) return;
    await fetch(`/api/organizations/${orgId}/agents/${id}`, { method: "DELETE" });
    trackAgentDelete();
    fetchData();
    fetchOrganization(orgId, true);
  };

  const openEditModal = (row: AgentRow) => {
    setEditAgent({
      id: row.id,
      name: row.name,
      description: row.description ?? "",
      vendor: row.vendor as Vendor,
      model: row.model,
      status: row.status as AgentStatus,
      monthlyCost: row.monthlyCost,
      deptId: row.deptId,
      humanId: row.humanId,
      runtimeType: row.runtimeType,
      gatewayUrl: row.gatewayUrl,
    });
  };

  const columns = [
    {
      key: "name",
      label: "Name",
      render: (row: AgentRow) => (
        <span className="text-sm text-white">{row.name}</span>
      ),
    },
    { key: "departmentName", label: "Department" },
    {
      key: "registeredByName",
      label: "Owner",
      render: (row: AgentRow) => {
        const name = row.registeredByName || row.humanName;
        if (!name) return <span className="text-slate-500">&mdash;</span>;
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
      render: (row: AgentRow) => <StatusBadge status={row.status} />,
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
      key: "grade",
      label: "Grade",
      render: (row: AgentRow) => <ActivityGradeBadge lastActive={row.lastActive} />,
      sortable: true,
    },
    {
      key: "lastActive",
      label: "Last Active",
      render: (row: AgentRow) => {
        const d = new Date(row.lastActive);
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
      },
    },
    ...(!isReadOnly
      ? [
          {
            key: "_actions",
            label: "",
            sortable: false,
            render: (row: AgentRow) => (
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); openEditModal(row); }}
                  className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
                  title="Edit agent"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                    <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(row.id, row.name); }}
                  className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/20"
                >
                  Delete
                </button>
              </div>
            ),
          },
        ]
      : []),
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
      <ReadOnlyToast visible={toastVisible} onDismiss={() => setToastVisible(false)} />

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Agents</h1>
        {!isReadOnly ? (
          <button
            onClick={async () => {
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
        ) : (
          <span className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-400">
            Template (read-only)
          </span>
        )}
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

      {editAgent && (
        <AgentForm
          departments={departments}
          members={members}
          orgId={orgId}
          editAgent={editAgent}
          onSubmit={handleEdit}
          onCancel={() => setEditAgent(null)}
        />
      )}
    </div>
  );
}

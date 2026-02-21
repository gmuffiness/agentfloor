"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable } from "@/components/database/DataTable";
import { useOrgId } from "@/hooks/useOrgId";
import { formatCurrency } from "@/lib/utils";
import { SERVICE_PRESETS } from "@/types";
import type { MemberSubscription, ServiceCategory, CostType, BillingCycle } from "@/types";

interface MemberRow {
  id: string;
  name: string;
  email: string | null;
  role: string;
  avatarUrl: string;
  joinedAt: string;
  agentCount: number;
  subscriptions: MemberSubscription[];
  totalCost: number;
  [key: string]: unknown;
}

const CATEGORY_COLORS: Record<ServiceCategory, string> = {
  ai_assistant: "bg-purple-500/20 text-purple-400",
  code_editor: "bg-blue-500/20 text-blue-400",
  image_gen: "bg-pink-500/20 text-pink-400",
  api: "bg-green-500/20 text-green-400",
  other: "bg-slate-500/20 text-slate-400",
};

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    admin: "bg-orange-500/20 text-orange-400",
    member: "bg-slate-500/20 text-slate-400",
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[role] ?? "bg-slate-500/20 text-slate-400"}`}>
      {role}
    </span>
  );
}

function SubscriptionBadges({ subscriptions }: { subscriptions: MemberSubscription[] }) {
  const active = subscriptions.filter((s) => s.isActive);
  if (active.length === 0) return <span className="text-slate-500">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {active.map((sub) => (
        <span
          key={sub.id}
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[sub.serviceCategory] ?? CATEGORY_COLORS.other}`}
          title={`${sub.serviceName} — ${formatCurrency(sub.monthlyAmount)}/mo`}
        >
          {sub.serviceName}
        </span>
      ))}
    </div>
  );
}

interface AddSubscriptionModalProps {
  members: { id: string; name: string }[];
  defaultMemberId?: string;
  onSubmit: (data: {
    memberId: string;
    serviceName: string;
    serviceCategory: ServiceCategory;
    costType: CostType;
    monthlyAmount: number;
    currency: string;
    billingCycle: BillingCycle;
  }) => Promise<void>;
  onCancel: () => void;
}

function AddSubscriptionModal({ members, defaultMemberId, onSubmit, onCancel }: AddSubscriptionModalProps) {
  const [memberId, setMemberId] = useState(defaultMemberId ?? members[0]?.id ?? "");
  const [serviceName, setServiceName] = useState("");
  const [serviceCategory, setServiceCategory] = useState<ServiceCategory>("ai_assistant");
  const [costType, setCostType] = useState<CostType>("subscription");
  const [monthlyAmount, setMonthlyAmount] = useState(0);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [submitting, setSubmitting] = useState(false);
  const [customMode, setCustomMode] = useState(false);

  const applyPreset = (preset: typeof SERVICE_PRESETS[number]) => {
    setServiceName(preset.name);
    setServiceCategory(preset.category);
    setCostType(preset.costType);
    setMonthlyAmount(preset.defaultAmount);
    setBillingCycle(preset.billingCycle);
    setCustomMode(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId || !serviceName.trim()) return;
    setSubmitting(true);
    await onSubmit({
      memberId,
      serviceName: serviceName.trim(),
      serviceCategory,
      costType,
      monthlyAmount,
      currency: "USD",
      billingCycle,
    });
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-white">Add Subscription</h2>

        {/* Member select */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-slate-400">Member</label>
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* Quick-select presets */}
        {!customMode && (
          <div className="mb-4">
            <label className="mb-2 block text-xs font-medium text-slate-400">Quick Select</label>
            <div className="flex flex-wrap gap-2">
              {SERVICE_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    serviceName === preset.name
                      ? "border-blue-500 bg-blue-500/20 text-blue-300"
                      : "border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500 hover:text-white"
                  }`}
                >
                  {preset.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setCustomMode(true); setServiceName(""); }}
                className="rounded-full border border-dashed border-slate-600 bg-transparent px-3 py-1 text-xs font-medium text-slate-400 hover:border-slate-400 hover:text-white"
              >
                + Custom
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Service name */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Service Name</label>
            <input
              type="text"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="e.g. Claude Pro"
              required
              className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Category */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Category</label>
              <select
                value={serviceCategory}
                onChange={(e) => setServiceCategory(e.target.value as ServiceCategory)}
                className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="ai_assistant">AI Assistant</option>
                <option value="code_editor">Code Editor</option>
                <option value="image_gen">Image Gen</option>
                <option value="api">API</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Cost type */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Cost Type</label>
              <select
                value={costType}
                onChange={(e) => setCostType(e.target.value as CostType)}
                className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="subscription">Subscription</option>
                <option value="api">API</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Monthly amount */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Monthly Amount (USD)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={monthlyAmount}
                onChange={(e) => setMonthlyAmount(parseFloat(e.target.value) || 0)}
                className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Billing cycle */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Billing Cycle</label>
              <select
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
                className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
                <option value="pay_as_you_go">Pay as you go</option>
              </select>
            </div>
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded px-4 py-2 text-sm text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !serviceName.trim() || !memberId}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {submitting ? "Adding..." : "Add Subscription"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function HumansPage() {
  const orgId = useOrgId();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [defaultMemberId, setDefaultMemberId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [membersRes, agentsRes, subsRes] = await Promise.all([
      fetch(`/api/organizations/${orgId}/members`),
      fetch(`/api/organizations/${orgId}/agents`),
      fetch(`/api/organizations/${orgId}/subscriptions`),
    ]);

    if (!membersRes.ok) { setLoading(false); return; }

    const membersData = await membersRes.json();
    const agentsData = agentsRes.ok ? await agentsRes.json() : [];
    const allSubs: MemberSubscription[] = subsRes.ok ? await subsRes.json() : [];

    const rows: MemberRow[] = ((membersData.members ?? []) as { id: string; name: string; email: string | null; role: string; avatar_url?: string; avatarUrl?: string; joined_at?: string; joinedAt?: string }[]).map((m) => {
      const agentCount = (agentsData as { human_id?: string | null; humanId?: string | null }[]).filter(
        (a) => (a.human_id ?? a.humanId) === m.id
      ).length;
      const subs = allSubs.filter((s) => s.memberId === m.id);
      const totalCost = subs.filter((s) => s.isActive).reduce((sum, s) => sum + s.monthlyAmount, 0);
      return {
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role,
        avatarUrl: m.avatar_url ?? m.avatarUrl ?? "",
        joinedAt: m.joined_at ?? m.joinedAt ?? "",
        agentCount,
        subscriptions: subs,
        totalCost,
      };
    });

    setMembers(rows);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddSubscription = async (data: {
    memberId: string;
    serviceName: string;
    serviceCategory: ServiceCategory;
    costType: CostType;
    monthlyAmount: number;
    currency: string;
    billingCycle: BillingCycle;
  }) => {
    await fetch(`/api/organizations/${orgId}/subscriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setShowModal(false);
    fetchData();
  };

  const columns = [
    {
      key: "name",
      label: "Name",
      render: (row: MemberRow) => (
        <div className="flex items-center gap-2">
          {row.avatarUrl ? (
            <img src={row.avatarUrl} alt="" className="h-6 w-6 rounded-full" />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-medium text-white">
              {row.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="font-medium text-white">{row.name}</span>
        </div>
      ),
    },
    {
      key: "email",
      label: "Email",
      render: (row: MemberRow) => (
        row.email ? (
          <span className="text-slate-300">{row.email}</span>
        ) : (
          <span className="text-slate-500">—</span>
        )
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (row: MemberRow) => row.role ? <RoleBadge role={row.role} /> : <span className="text-slate-500">—</span>,
    },
    {
      key: "agentCount",
      label: "Agents",
      render: (row: MemberRow) => (
        row.agentCount > 0
          ? <span className="text-white">{row.agentCount}</span>
          : <span className="text-slate-500">0</span>
      ),
    },
    {
      key: "subscriptions",
      label: "Subscriptions",
      sortable: false,
      render: (row: MemberRow) => <SubscriptionBadges subscriptions={row.subscriptions} />,
    },
    {
      key: "totalCost",
      label: "Total Cost/mo",
      render: (row: MemberRow) => (
        row.totalCost > 0
          ? <span className="font-medium text-white">{formatCurrency(row.totalCost)}</span>
          : <span className="text-slate-500">—</span>
      ),
    },
    {
      key: "joinedAt",
      label: "Joined",
      render: (row: MemberRow) => {
        const d = new Date(row.joinedAt);
        return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
      },
    },
    {
      key: "_actions",
      label: "",
      sortable: false,
      render: (row: MemberRow) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDefaultMemberId(row.id);
            setShowModal(true);
          }}
          className="rounded px-2 py-1 text-xs text-blue-400 hover:bg-blue-500/20"
        >
          + Subscription
        </button>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-slate-400">Loading members...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Humans</h1>
        <button
          onClick={() => { setDefaultMemberId(undefined); setShowModal(true); }}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          + Add Subscription
        </button>
      </div>

      <DataTable
        columns={columns}
        data={members}
        searchPlaceholder="Search members..."
        searchKeys={["name", "email", "role"]}
      />

      {showModal && (
        <AddSubscriptionModal
          members={members.map((m) => ({ id: m.id, name: m.name }))}
          defaultMemberId={defaultMemberId}
          onSubmit={handleAddSubscription}
          onCancel={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

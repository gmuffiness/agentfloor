"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { SERVICE_PRESETS } from "@/types";
import type { MemberSubscription, ServiceCategory, CostType, BillingCycle } from "@/types";

interface SubscriptionManagerProps {
  orgId: string;
  memberId: string | null;
  isAdmin: boolean;
}

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  ai_assistant: "AI Assistant",
  code_editor: "Code Editor",
  image_gen: "Image Gen",
  api: "API",
  other: "Other",
};

const CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: "Monthly",
  annual: "Annual",
  pay_as_you_go: "Pay-as-you-go",
};

export default function SubscriptionManager({ orgId, memberId }: SubscriptionManagerProps) {
  const [subscriptions, setSubscriptions] = useState<MemberSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);

  // Add form state
  const [addPreset, setAddPreset] = useState<string>("");
  const [addCustomName, setAddCustomName] = useState("");
  const [addCategory, setAddCategory] = useState<ServiceCategory>("other");
  const [addCostType, setAddCostType] = useState<CostType>("subscription");
  const [addAmount, setAddAmount] = useState<number>(0);
  const [addCycle, setAddCycle] = useState<BillingCycle>("monthly");

  const fetchSubscriptions = useCallback(async () => {
    const url = memberId
      ? `/api/organizations/${orgId}/subscriptions?memberId=${memberId}`
      : `/api/organizations/${orgId}/subscriptions`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      setSubscriptions(data);
    }
    setLoading(false);
  }, [orgId, memberId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const url = memberId
        ? `/api/organizations/${orgId}/subscriptions?memberId=${memberId}`
        : `/api/organizations/${orgId}/subscriptions`;
      const res = await fetch(url);
      if (cancelled) return;
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data);
      }
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [orgId, memberId]);

  const handlePresetChange = (presetName: string) => {
    setAddPreset(presetName);
    if (presetName === "__custom__") {
      setAddCustomName("");
      setAddCategory("other");
      setAddCostType("subscription");
      setAddAmount(0);
      setAddCycle("monthly");
      return;
    }
    const preset = SERVICE_PRESETS.find((p) => p.name === presetName);
    if (preset) {
      setAddCategory(preset.category);
      setAddCostType(preset.costType);
      setAddAmount(preset.defaultAmount);
      setAddCycle(preset.billingCycle);
    }
  };

  const handleAdd = async () => {
    const serviceName = addPreset === "__custom__" ? addCustomName.trim() : addPreset;
    if (!serviceName || !memberId) return;

    const res = await fetch(`/api/organizations/${orgId}/subscriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId,
        serviceName,
        serviceCategory: addCategory,
        costType: addCostType,
        monthlyAmount: addAmount,
        billingCycle: addCycle,
      }),
    });

    if (res.ok) {
      setShowAdd(false);
      setAddPreset("");
      setAddCustomName("");
      fetchSubscriptions();
    }
  };

  const handleUpdateAmount = async (subId: string) => {
    const res = await fetch(`/api/organizations/${orgId}/subscriptions/${subId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthlyAmount: editAmount }),
    });
    if (res.ok) {
      setEditingId(null);
      fetchSubscriptions();
    }
  };

  const handleRemove = async (subId: string) => {
    const res = await fetch(`/api/organizations/${orgId}/subscriptions/${subId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      fetchSubscriptions();
    }
  };

  if (loading) {
    return <div className="text-slate-400 py-4">Loading subscriptions...</div>;
  }

  return (
    <div>
      {subscriptions.length === 0 && !showAdd ? (
        <p className="text-sm text-slate-400 mb-4">
          No subscriptions registered yet. Add your AI service subscriptions or run <code className="bg-slate-900 px-1 rounded">agent-factorio push</code> to auto-detect.
        </p>
      ) : (
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="border-b border-slate-700 text-left text-slate-300">
              <th className="pb-2 font-medium">Service</th>
              <th className="pb-2 font-medium">Type</th>
              <th className="pb-2 font-medium">Amount</th>
              <th className="pb-2 font-medium">Cycle</th>
              <th className="pb-2 font-medium">Source</th>
              <th className="pb-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map((sub) => (
              <tr key={sub.id} className="border-b border-slate-700/50">
                <td className="py-2.5">
                  <span className="text-white">{sub.serviceName}</span>
                  {sub.autoDetected && (
                    <span className="ml-1.5 inline-block rounded bg-blue-500/20 px-1.5 py-0.5 text-xs text-blue-400">
                      auto
                    </span>
                  )}
                </td>
                <td className="py-2.5 text-slate-300">
                  {CATEGORY_LABELS[sub.serviceCategory] || sub.serviceCategory}
                </td>
                <td className="py-2.5">
                  {editingId === sub.id ? (
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">$</span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={editAmount}
                        onChange={(e) => setEditAmount(parseFloat(e.target.value) || 0)}
                        className="w-20 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleUpdateAmount(sub.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                      <button
                        onClick={() => handleUpdateAmount(sub.id)}
                        className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500"
                      >
                        Save
                      </button>
                    </div>
                  ) : sub.monthlyAmount === 0 && sub.costType !== "api" ? (
                    <button
                      onClick={() => { setEditingId(sub.id); setEditAmount(0); }}
                      className="rounded border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400 hover:bg-amber-500/20"
                    >
                      Set Price
                    </button>
                  ) : (
                    <span className="text-white">
                      {sub.costType === "api" && sub.monthlyAmount === 0
                        ? "—"
                        : `$${sub.monthlyAmount}/mo`}
                    </span>
                  )}
                </td>
                <td className="py-2.5 text-slate-300">{CYCLE_LABELS[sub.billingCycle]}</td>
                <td className="py-2.5">
                  <span className={cn(
                    "inline-block rounded px-1.5 py-0.5 text-xs",
                    sub.detectionSource === "manual"
                      ? "bg-slate-500/20 text-slate-400"
                      : "bg-green-500/20 text-green-400",
                  )}>
                    {sub.detectionSource || "manual"}
                  </span>
                </td>
                <td className="py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {editingId !== sub.id && (
                      <button
                        onClick={() => { setEditingId(sub.id); setEditAmount(sub.monthlyAmount); }}
                        className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 hover:text-white"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      onClick={() => handleRemove(sub.id)}
                      className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/20"
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Add Subscription Form */}
      {showAdd ? (
        <div className="rounded-lg border border-slate-600 bg-slate-900 p-4 space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-300">Service</label>
            <select
              value={addPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-64 rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="">Select a service...</option>
              {SERVICE_PRESETS.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
              <option value="__custom__">Custom...</option>
            </select>
          </div>

          {addPreset === "__custom__" && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-300">Service Name</label>
              <input
                type="text"
                value={addCustomName}
                onChange={(e) => setAddCustomName(e.target.value)}
                placeholder="e.g. Replit AI"
                className="w-64 rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}

          {addPreset && (
            <div className="flex gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-300">Category</label>
                <select
                  value={addCategory}
                  onChange={(e) => setAddCategory(e.target.value as ServiceCategory)}
                  className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-300">Amount (USD/mo)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={addAmount}
                  onChange={(e) => setAddAmount(parseFloat(e.target.value) || 0)}
                  className="w-28 rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-300">Billing Cycle</label>
                <select
                  value={addCycle}
                  onChange={(e) => setAddCycle(e.target.value as BillingCycle)}
                  className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  {Object.entries(CYCLE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleAdd}
              disabled={!addPreset || (addPreset === "__custom__" && !addCustomName.trim())}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              Add
            </button>
            <button
              onClick={() => { setShowAdd(false); setAddPreset(""); }}
              className="rounded px-4 py-2 text-sm text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="rounded border border-dashed border-slate-600 px-4 py-2 text-sm text-slate-400 hover:border-slate-500 hover:text-white"
        >
          + Add Subscription
        </button>
      )}
    </div>
  );
}

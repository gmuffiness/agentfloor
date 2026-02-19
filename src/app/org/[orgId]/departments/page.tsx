"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable } from "@/components/database/DataTable";
import { DepartmentForm } from "@/components/database/DepartmentForm";
import { useAppStore } from "@/stores/app-store";
import { useOrgId } from "@/hooks/useOrgId";
import { formatCurrency } from "@/lib/utils";
import type { Vendor } from "@/types";

interface DeptRow {
  id: string;
  name: string;
  description: string;
  budget: number;
  monthlySpend: number;
  primaryVendor: string;
  agentCount: number;
  [key: string]: unknown;
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

export default function DepartmentsPage() {
  const orgId = useOrgId();
  const [departments, setDepartments] = useState<DeptRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const selectDepartment = useAppStore((s) => s.selectDepartment);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/organizations/${orgId}/departments`);
    setDepartments(await res.json());
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (data: {
    name: string;
    description: string;
    budget: number;
    primaryVendor: Vendor;
  }) => {
    await fetch(`/api/organizations/${orgId}/departments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setShowForm(false);
    fetchData();
  };

  const handleNameChange = async (id: string, name: string) => {
    if (!name.trim()) return;
    await fetch(`/api/organizations/${orgId}/departments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    fetchData();
  };

  const handleBudgetChange = async (id: string, budget: number) => {
    await fetch(`/api/organizations/${orgId}/departments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ budget }),
    });
    fetchData();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete department "${name}"? All agents must be removed first.`)) return;
    const res = await fetch(`/api/organizations/${orgId}/departments/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Failed to delete department");
      return;
    }
    fetchData();
  };

  const columns = [
    {
      key: "name",
      label: "Name",
      render: (row: DeptRow) => (
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
    {
      key: "agentCount",
      label: "Agents",
      render: (row: DeptRow) => <span className="font-mono">{row.agentCount}</span>,
    },
    {
      key: "monthlySpend",
      label: "Spend",
      render: (row: DeptRow) => formatCurrency(row.monthlySpend),
    },
    {
      key: "budget",
      label: "Budget",
      render: (row: DeptRow) => (
        <input
          type="number"
          defaultValue={row.budget}
          onBlur={(e) => {
            const val = Number(e.target.value);
            if (val !== row.budget) handleBudgetChange(row.id, val);
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-24 rounded border border-slate-600 bg-transparent px-2 py-0.5 text-sm text-white focus:border-blue-500 focus:outline-none"
          min={0}
        />
      ),
    },
    {
      key: "primaryVendor",
      label: "Primary Vendor",
      render: (row: DeptRow) => <VendorBadge vendor={row.primaryVendor} />,
    },
    {
      key: "_actions",
      label: "",
      sortable: false,
      render: (row: DeptRow) => (
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
        <div className="text-slate-400">Loading departments...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Departments</h1>
        <button
          onClick={() => setShowForm(true)}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          + Add Department
        </button>
      </div>

      <DataTable
        columns={columns}
        data={departments}
        onRowClick={(row) => selectDepartment(row.id)}
        searchPlaceholder="Search departments..."
        searchKeys={["name", "description", "primaryVendor"]}
      />

      {showForm && (
        <DepartmentForm
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

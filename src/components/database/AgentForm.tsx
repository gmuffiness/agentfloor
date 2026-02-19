"use client";

import { useState } from "react";
import type { Vendor, AgentStatus } from "@/types";

interface AgentFormProps {
  departments: { id: string; name: string }[];
  humans: { id: string; name: string }[];
  onSubmit: (data: {
    name: string;
    description: string;
    vendor: Vendor;
    model: string;
    status: AgentStatus;
    monthlyCost: number;
    deptId: string;
    humanId: string | null;
  }) => void;
  onCancel: () => void;
  onCreateHuman?: (name: string) => Promise<string | null>;
}

export function AgentForm({ departments, humans, onSubmit, onCancel, onCreateHuman }: AgentFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [vendor, setVendor] = useState<Vendor>("anthropic");
  const [model, setModel] = useState("");
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [monthlyCost, setMonthlyCost] = useState(0);
  const [deptId, setDeptId] = useState(departments[0]?.id ?? "");
  const [humanId, setHumanId] = useState<string | null>(null);
  const [showNewHuman, setShowNewHuman] = useState(false);
  const [newHumanName, setNewHumanName] = useState("");
  const [creatingHuman, setCreatingHuman] = useState(false);
  const [humanList, setHumanList] = useState(humans);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !deptId) return;
    onSubmit({ name, description, vendor, model, status, monthlyCost, deptId, humanId });
  };

  const handleCreateHuman = async () => {
    if (!newHumanName.trim() || !onCreateHuman) return;
    setCreatingHuman(true);
    const id = await onCreateHuman(newHumanName.trim());
    if (id) {
      setHumanList((prev) => [...prev, { id, name: newHumanName.trim() }]);
      setHumanId(id);
    }
    setNewHumanName("");
    setShowNewHuman(false);
    setCreatingHuman(false);
  };

  const inputClass = "w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none";
  const labelClass = "block text-sm font-medium text-slate-300 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-lg bg-slate-900 p-6 border border-slate-700">
        <h2 className="mb-4 text-lg font-bold text-white">Add Agent</h2>

        <div className="flex flex-col gap-3">
          <div>
            <label className={labelClass}>Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} rows={2} />
          </div>
          <div>
            <label className={labelClass}>Department *</label>
            <select value={deptId} onChange={(e) => setDeptId(e.target.value)} className={inputClass} required>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Owner</label>
            {showNewHuman ? (
              <div className="flex gap-2">
                <input
                  value={newHumanName}
                  onChange={(e) => setNewHumanName(e.target.value)}
                  className={inputClass}
                  placeholder="Enter name"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); handleCreateHuman(); }
                    if (e.key === "Escape") setShowNewHuman(false);
                  }}
                />
                <button
                  type="button"
                  onClick={handleCreateHuman}
                  disabled={creatingHuman || !newHumanName.trim()}
                  className="shrink-0 rounded bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-500 disabled:opacity-50"
                >
                  {creatingHuman ? "..." : "Add"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewHuman(false)}
                  className="shrink-0 rounded px-2 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  value={humanId ?? ""}
                  onChange={(e) => setHumanId(e.target.value || null)}
                  className={inputClass}
                >
                  <option value="">None</option>
                  {humanList.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewHuman(true)}
                  className="shrink-0 rounded border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                >
                  + New
                </button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Vendor</label>
              <select value={vendor} onChange={(e) => setVendor(e.target.value as Vendor)} className={inputClass}>
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="google">Google</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Model</label>
              <input value={model} onChange={(e) => setModel(e.target.value)} className={inputClass} placeholder="e.g. Claude Sonnet 4.5" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as AgentStatus)} className={inputClass}>
                <option value="active">Active</option>
                <option value="idle">Idle</option>
                <option value="error">Error</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Monthly Cost ($)</label>
              <input type="number" value={monthlyCost} onChange={(e) => setMonthlyCost(Number(e.target.value))} className={inputClass} min={0} />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded px-4 py-2 text-sm text-slate-400 hover:text-white">
            Cancel
          </button>
          <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">
            Create Agent
          </button>
        </div>
      </form>
    </div>
  );
}

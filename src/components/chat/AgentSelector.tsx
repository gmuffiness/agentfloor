"use client";

import { cn } from "@/lib/utils";
import { getVendorLabel } from "@/lib/utils";
import type { Vendor } from "@/types";

interface AgentItem {
  id: string;
  name: string;
  vendor: Vendor;
  model: string;
  status: string;
}

interface AgentSelectorProps {
  agents: AgentItem[];
  selectedAgentId: string | null;
  onSelect: (agentId: string) => void;
}

const vendorBadgeClass: Record<string, string> = {
  anthropic: "bg-orange-500/20 text-orange-400",
  openai: "bg-green-500/20 text-green-400",
  google: "bg-blue-500/20 text-blue-400",
};

const statusDotClass: Record<string, string> = {
  active: "bg-green-400",
  idle: "bg-yellow-400",
  error: "bg-red-400",
};

export function AgentSelector({ agents, selectedAgentId, onSelect }: AgentSelectorProps) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        Agents
      </h3>
      {agents.map((agent) => (
        <button
          key={agent.id}
          onClick={() => onSelect(agent.id)}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
            selectedAgentId === agent.id
              ? "bg-slate-700 text-white"
              : "text-slate-300 hover:bg-slate-800"
          )}
        >
          <span className={cn("h-2 w-2 shrink-0 rounded-full", statusDotClass[agent.status] ?? "bg-slate-500")} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{agent.name}</p>
            <div className="mt-0.5 flex items-center gap-2">
              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", vendorBadgeClass[agent.vendor] ?? "bg-slate-600 text-slate-300")}>
                {getVendorLabel(agent.vendor)}
              </span>
              <span className="truncate text-[10px] text-slate-500">{agent.model}</span>
            </div>
          </div>
        </button>
      ))}
      {agents.length === 0 && (
        <p className="px-2 text-xs text-slate-500">No agents found</p>
      )}
    </div>
  );
}

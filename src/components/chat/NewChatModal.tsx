"use client";

import { useState } from "react";
import { cn, getVendorLabel } from "@/lib/utils";
import type { Vendor } from "@/types";

const vendorBadgeClass: Record<string, string> = {
  anthropic: "bg-orange-500/20 text-orange-300",
  openai: "bg-emerald-500/20 text-emerald-300",
  google: "bg-blue-500/20 text-blue-300",
};

interface AgentItem {
  id: string;
  name: string;
  vendor: Vendor;
  model: string;
  status: string;
}

interface NewChatModalProps {
  agents: AgentItem[];
  onClose: () => void;
  onCreate: (agentIds: string[], title?: string) => void;
}

const statusDotClass: Record<string, string> = {
  active: "bg-emerald-400",
  idle: "bg-yellow-400",
  error: "bg-red-400",
};

function AgentInitials({ name, vendor }: { name: string; vendor: Vendor }) {
  const initials = name
    .split(/[\s-_]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const bgColor =
    vendor === "anthropic"
      ? "bg-orange-500/20 text-orange-300 ring-orange-500/30"
      : vendor === "openai"
      ? "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30"
      : vendor === "google"
      ? "bg-blue-500/20 text-blue-300 ring-blue-500/30"
      : "bg-slate-600/40 text-slate-300 ring-slate-500/30";

  return (
    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 text-[11px] font-bold", bgColor)}>
      {initials || "A"}
    </div>
  );
}

export function NewChatModal({ agents, onClose, onCreate }: NewChatModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");

  const toggleAgent = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreate = () => {
    if (selectedIds.size === 0) return;
    onCreate(Array.from(selectedIds), title.trim() || undefined);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-700/60 bg-slate-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-700/60 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">New Conversation</h2>
            <p className="mt-0.5 text-xs text-slate-400">Select one or more agents to chat with</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-700 hover:text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            placeholder="Conversation title (optional)"
            className="mb-4 w-full rounded-xl border border-slate-600/60 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 transition-colors focus:border-slate-500 focus:outline-none"
          />

          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Available Agents
          </p>

          <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-700/40">
            {agents.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
                <p className="text-xs">No agents available</p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-slate-700/30">
                {agents.map((agent) => {
                  const selected = selectedIds.has(agent.id);
                  return (
                    <button
                      key={agent.id}
                      onClick={() => toggleAgent(agent.id)}
                      className={cn(
                        "flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors first:rounded-t-xl last:rounded-b-xl",
                        selected
                          ? "bg-blue-600/10"
                          : "hover:bg-slate-700/40"
                      )}
                    >
                      {/* Checkbox */}
                      <div className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                        selected
                          ? "border-blue-500 bg-blue-600"
                          : "border-slate-600 bg-slate-900"
                      )}>
                        {selected && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>

                      {/* Avatar */}
                      <AgentInitials name={agent.name} vendor={agent.vendor} />

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-slate-100">{agent.name}</p>
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusDotClass[agent.status] ?? "bg-slate-500")} />
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide", vendorBadgeClass[agent.vendor] ?? "bg-slate-600/40 text-slate-300")}>
                            {getVendorLabel(agent.vendor)}
                          </span>
                          <span className="truncate text-[10px] text-slate-500">{agent.model}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-700/60 px-5 py-3">
          <span className="text-xs text-slate-500">
            {selectedIds.size > 0
              ? `${selectedIds.size} agent${selectedIds.size !== 1 ? "s" : ""} selected`
              : "No agents selected"}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={selectedIds.size === 0}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Start Chat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

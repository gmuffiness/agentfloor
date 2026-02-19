"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "@/stores/app-store";
import { formatCurrency, getVendorColor, cn } from "@/lib/utils";
import { StatusBadge, VendorBadge } from "@/components/ui/Badge";
import UsageBarChart from "@/components/charts/UsageBarChart";
import type { Agent, AgentContext } from "@/types";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type Tab = "overview" | "tools" | "context" | "usage";

type PushServerStatus = "none" | "pending" | "completed";

interface PushStatusData {
  status: PushServerStatus;
  announcement?: { id: string; createdAt: string; ackedAt?: string };
}

export function AgentDrawer() {
  const getSelectedAgent = useAppStore((s) => s.getSelectedAgent);
  const selectedAgentId = useAppStore((s) => s.selectedAgentId);
  const currentOrgId = useAppStore((s) => s.currentOrgId);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const organization = useAppStore((s) => s.organization);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [fetchedAgent, setFetchedAgent] = useState<Agent | null>(null);
  const [pushStatus, setPushStatus] = useState<PushStatusData>({ status: "none" });
  const [pushSending, setPushSending] = useState(false);
  const [pushError, setPushError] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const fetchPushStatus = useCallback(async (orgId: string, agentId: string): Promise<PushStatusData | null> => {
    try {
      const res = await fetch(`/api/organizations/${orgId}/agents/${agentId}/push-request`);
      if (!res.ok) return null;
      return await res.json() as PushStatusData;
    } catch {
      return null;
    }
  }, []);

  // Fetch push status when agent is selected
  useEffect(() => {
    setPushStatus({ status: "none" });
    setPushSending(false);
    setPushError(false);
    stopPolling();

    if (!selectedAgentId || !currentOrgId) return;

    let cancelled = false;
    fetchPushStatus(currentOrgId, selectedAgentId).then((data) => {
      if (cancelled || !data) return;
      setPushStatus(data);
      // Start polling if pending
      if (data.status === "pending") {
        startPolling(currentOrgId, selectedAgentId);
      }
    });

    return () => { cancelled = true; stopPolling(); };
  }, [selectedAgentId, currentOrgId, fetchPushStatus, stopPolling]);

  function startPolling(orgId: string, agentId: string) {
    stopPolling();
    let elapsed = 0;
    pollingRef.current = setInterval(async () => {
      elapsed += 5000;
      if (elapsed > 60000) { stopPolling(); return; }
      const data = await fetchPushStatus(orgId, agentId);
      if (!data) return;
      setPushStatus(data);
      if (data.status === "completed") stopPolling();
    }, 5000);
  }

  async function handlePushRequest() {
    if (!currentOrgId || !selectedAgentId) return;
    setPushSending(true);
    setPushError(false);
    try {
      const res = await fetch(
        `/api/organizations/${currentOrgId}/agents/${selectedAgentId}/push-request`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) },
      );
      if (res.ok) {
        setPushSending(false);
        setPushStatus({ status: "pending" });
        startPolling(currentOrgId, selectedAgentId);
      } else {
        setPushSending(false);
        setPushError(true);
      }
    } catch {
      setPushSending(false);
      setPushError(true);
    }
  }

  // If agent not in store (e.g. agents table page), fetch from API
  useEffect(() => {
    if (!selectedAgentId) { setFetchedAgent(null); return; }
    const storeAgent = getSelectedAgent();
    if (storeAgent) { setFetchedAgent(null); return; }
    if (!currentOrgId) { setFetchedAgent(null); return; }

    let cancelled = false;
    fetch(`/api/organizations/${currentOrgId}/agents/${selectedAgentId}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (cancelled || !data) return;
        const mapped: Agent = {
          id: data.id,
          name: data.name,
          description: data.description ?? "",
          vendor: data.vendor,
          model: data.model,
          status: data.status,
          monthlyCost: data.monthly_cost ?? data.monthlyCost ?? 0,
          tokensUsed: data.tokens_used ?? data.tokensUsed ?? 0,
          position: data.position ?? { x: data.pos_x ?? 0, y: data.pos_y ?? 0 },
          skills: data.skills ?? [],
          plugins: data.plugins ?? [],
          mcpTools: data.mcpTools ?? [],
          resources: data.resources ?? [],
          usageHistory: data.usageHistory ?? [],
          lastActive: data.last_active ?? data.lastActive ?? "",
          createdAt: data.created_at ?? data.createdAt ?? "",
          humanId: data.human_id ?? data.humanId ?? null,
          registeredBy: data.registered_by ?? data.registeredBy ?? null,
          registeredByMember: data.registeredByMember ?? null,
          context: data.context ?? [],
        };
        setFetchedAgent(mapped);
      })
      .catch(() => setFetchedAgent(null));
    return () => { cancelled = true; };
  }, [selectedAgentId, getSelectedAgent]);

  const agent = getSelectedAgent() ?? fetchedAgent;
  const isOpen = agent !== null;

  const department = agent
    ? organization.departments.find((d) =>
        d.agents.some((a) => a.id === agent.id)
      )
    : null;

  const totalRequests = agent
    ? agent.usageHistory.reduce((sum, d) => sum + d.requests, 0)
    : 0;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "tools", label: "Skills & Tools", count: agent ? agent.skills.length + agent.plugins.length + agent.mcpTools.length + (agent.resources?.length ?? 0) : 0 },
    { id: "context", label: "Context", count: agent?.context?.length ?? 0 },
    { id: "usage", label: "Usage" },
  ];

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/20 transition-opacity duration-300",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => { selectAgent(null); setActiveTab("overview"); }}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed right-0 top-12 z-50 h-[calc(100%-3rem)] w-[440px] overflow-y-auto bg-white shadow-2xl transition-transform duration-300",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {agent && (
          <div className="flex flex-col">
            {/* Header */}
            <div className="border-b border-gray-100 p-6 pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-white text-sm font-bold"
                    style={{ backgroundColor: getVendorColor(agent.vendor) }}
                  >
                    {agent.vendor === "anthropic" ? "C" : agent.vendor === "openai" ? "G" : "Ge"}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {agent.name}
                    </h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      {department && (
                        <span className="text-xs text-slate-500">{department.name}</span>
                      )}
                      <span className="text-slate-300">·</span>
                      <span className="text-xs text-slate-400">{timeAgo(agent.lastActive)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={pushStatus.status === "completed" ? () => { setPushStatus({ status: "none" }); } : handlePushRequest}
                    disabled={pushSending || pushStatus.status === "pending"}
                    title={
                      pushStatus.status === "completed"
                        ? `Push completed ${pushStatus.announcement?.ackedAt ? timeAgo(pushStatus.announcement.ackedAt) : ""}`
                        : "Request agent to run agentfloor push"
                    }
                    className={cn(
                      "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                      pushStatus.status === "completed"
                        ? "bg-green-50 text-green-600 border border-green-100 hover:bg-green-100"
                        : pushStatus.status === "pending"
                          ? "bg-amber-50 text-amber-600 border border-amber-100"
                          : pushError
                            ? "bg-red-50 text-red-500 border border-red-100 hover:bg-red-100"
                            : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    {pushSending ? (
                      <>
                        <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Sending...
                      </>
                    ) : pushStatus.status === "completed" ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
                          <path d="M5 10l4 4 6-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Push Completed
                      </>
                    ) : pushStatus.status === "pending" ? (
                      <>
                        <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Push Pending
                      </>
                    ) : pushError ? (
                      "Failed"
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
                          <path d="M10 3v10M10 3l-3 3M10 3l3 3M4 13v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Request Push
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => { selectAgent(null); setActiveTab("overview"); }}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                  >
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                      <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 mt-3">
                <VendorBadge vendor={agent.vendor} />
                <span className="text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full">{agent.model}</span>
                <StatusBadge status={agent.status} />
              </div>

              {/* Description */}
              <p className="mt-3 text-xs text-slate-500 leading-relaxed">{agent.description}</p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px",
                    activeTab === tab.id
                      ? "border-slate-900 text-slate-900"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  )}
                >
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-6 flex flex-col gap-5">
              {activeTab === "overview" && (
                <>
                  {/* Cost Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Cost</div>
                      <div className="text-base font-bold text-slate-900 mt-0.5">
                        {formatCurrency(agent.monthlyCost)}
                      </div>
                      <div className="text-[10px] text-slate-400">per month</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Tokens</div>
                      <div className="text-base font-bold text-slate-900 mt-0.5">
                        {formatTokens(agent.tokensUsed)}
                      </div>
                      <div className="text-[10px] text-slate-400">this month</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Requests</div>
                      <div className="text-base font-bold text-slate-900 mt-0.5">
                        {totalRequests.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400">last 7 days</div>
                    </div>
                  </div>

                  {/* Quick Skills Preview */}
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Skills ({agent.skills.length})
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {agent.skills.map((skill) => (
                        <div
                          key={skill.id}
                          className="flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1 text-xs"
                        >
                          <span className="text-sm">{skill.icon}</span>
                          <span className="text-slate-700 font-medium">{skill.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick MCP Preview */}
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      MCP Tools ({agent.mcpTools.length})
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {agent.mcpTools.map((tool) => (
                        <div
                          key={tool.id}
                          className="flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-100 px-2.5 py-1 text-xs"
                        >
                          <span className="text-sm">{tool.icon}</span>
                          <span className="text-blue-700 font-medium">{tool.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick Resources Preview */}
                  {agent.resources?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                        Resources ({agent.resources.length})
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {agent.resources.map((resource) => {
                          const colorMap = {
                            git_repo: { bg: "bg-purple-50", border: "border-purple-100", text: "text-purple-700" },
                            database: { bg: "bg-amber-50", border: "border-amber-100", text: "text-amber-700" },
                            storage: { bg: "bg-teal-50", border: "border-teal-100", text: "text-teal-700" },
                          };
                          const colors = colorMap[resource.type];
                          const chip = (
                            <div
                              className={cn("flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs", colors.bg, colors.border)}
                            >
                              <span className="text-sm">{resource.icon}</span>
                              <span className={cn("font-medium", colors.text)}>{resource.name}</span>
                            </div>
                          );
                          if (resource.url) {
                            return (
                              <a key={resource.id} href={resource.url} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
                                {chip}
                              </a>
                            );
                          }
                          return chip;
                        })}
                      </div>
                    </div>
                  )}

                  {/* Quick Plugin Preview */}
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Plugins ({agent.plugins.length})
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {agent.plugins.map((plugin) => (
                        <div
                          key={plugin.id}
                          className={cn(
                            "flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs",
                            plugin.enabled
                              ? "bg-green-50 border-green-100"
                              : "bg-gray-50 border-gray-200 opacity-60"
                          )}
                        >
                          <span className="text-sm">{plugin.icon}</span>
                          <span className={plugin.enabled ? "text-green-700 font-medium" : "text-gray-500 font-medium"}>
                            {plugin.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {activeTab === "tools" && (
                <>
                  {/* Skills Detail */}
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                      Skills
                    </h3>
                    <div className="space-y-2">
                      {agent.skills.map((skill) => (
                        <div key={skill.id} className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                          <span className="text-lg mt-0.5">{skill.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900">{skill.name}</span>
                              <span className="text-[10px] rounded-full bg-slate-200 px-2 py-0.5 text-slate-500 capitalize">
                                {skill.category}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{skill.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* MCP Tools Detail */}
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                      MCP Servers & Tools
                    </h3>
                    <div className="space-y-2">
                      {agent.mcpTools.map((tool) => (
                        <div key={tool.id} className="flex items-start gap-3 rounded-xl bg-blue-50/60 border border-blue-100 p-3">
                          <span className="text-lg mt-0.5">{tool.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900">{tool.name}</span>
                              <span className="text-[10px] rounded-full bg-blue-100 px-2 py-0.5 text-blue-600 capitalize">
                                {tool.category}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{tool.description}</p>
                            <p className="text-[10px] text-blue-400 mt-1 font-mono">{tool.server}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Resources Detail */}
                  {agent.resources?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                        Resources
                      </h3>
                      <div className="space-y-2">
                        {agent.resources.map((resource) => {
                          const colorMap = {
                            git_repo: { bg: "bg-purple-50/60", border: "border-purple-100", badge: "bg-purple-100 text-purple-600", label: "git" },
                            database: { bg: "bg-amber-50/60", border: "border-amber-100", badge: "bg-amber-100 text-amber-600", label: "db" },
                            storage: { bg: "bg-teal-50/60", border: "border-teal-100", badge: "bg-teal-100 text-teal-600", label: "storage" },
                          };
                          const colors = colorMap[resource.type];
                          const accessColors = {
                            read: "bg-gray-100 text-gray-600",
                            write: "bg-blue-100 text-blue-600",
                            admin: "bg-red-100 text-red-600",
                          };
                          return (
                            <div key={resource.id} className={cn("flex items-start gap-3 rounded-xl p-3 border", colors.bg, colors.border)}>
                              <span className="text-lg mt-0.5">{resource.icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-slate-900">{resource.name}</span>
                                  <span className={cn("text-[10px] rounded-full px-2 py-0.5 capitalize", colors.badge)}>
                                    {colors.label}
                                  </span>
                                  <span className={cn("text-[10px] rounded-full px-2 py-0.5", accessColors[resource.accessLevel])}>
                                    {resource.accessLevel}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">{resource.description}</p>
                                {resource.url && (
                                  <a
                                    href={resource.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block text-[10px] text-blue-400 hover:text-blue-600 mt-1 font-mono truncate underline"
                                  >{resource.url}</a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Plugins Detail */}
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                      Plugins
                    </h3>
                    <div className="space-y-2">
                      {agent.plugins.map((plugin) => (
                        <div
                          key={plugin.id}
                          className={cn(
                            "flex items-start gap-3 rounded-xl p-3 border",
                            plugin.enabled
                              ? "bg-green-50/60 border-green-100"
                              : "bg-gray-50 border-gray-200 opacity-70"
                          )}
                        >
                          <span className="text-lg mt-0.5">{plugin.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900">{plugin.name}</span>
                              <span className="text-[10px] font-mono text-slate-400">v{plugin.version}</span>
                              {!plugin.enabled && (
                                <span className="text-[10px] rounded-full bg-gray-200 px-2 py-0.5 text-gray-500">
                                  disabled
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{plugin.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {activeTab === "context" && (
                <>
                  {agent.context && agent.context.length > 0 ? (
                    <div className="space-y-4">
                      {agent.context.map((ctx: AgentContext) => {
                        const labelMap: Record<string, { label: string; bg: string; border: string; text: string }> = {
                          claude_md: { label: "CLAUDE.md", bg: "bg-purple-50", border: "border-purple-100", text: "text-purple-600" },
                          readme: { label: "README", bg: "bg-blue-50", border: "border-blue-100", text: "text-blue-600" },
                          custom: { label: "Custom", bg: "bg-slate-50", border: "border-slate-100", text: "text-slate-600" },
                        };
                        const style = labelMap[ctx.type] ?? labelMap.custom;
                        return (
                          <div key={ctx.id} className="rounded-xl border border-slate-100 overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                              <div className="flex items-center gap-2">
                                <span className={cn("text-[10px] font-medium rounded-full px-2 py-0.5", style.bg, style.border, style.text, "border")}>
                                  {style.label}
                                </span>
                                {ctx.sourceFile && (
                                  <span className="text-[10px] text-slate-400 font-mono">{ctx.sourceFile}</span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400">
                                {new Date(ctx.updatedAt).toLocaleDateString()}
                              </span>
                            </div>
                            <pre className="p-4 text-xs text-slate-700 leading-relaxed overflow-x-auto max-h-80 overflow-y-auto whitespace-pre-wrap break-words font-mono bg-white">
                              {ctx.content}
                            </pre>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-slate-50 p-6 text-center">
                      <p className="text-sm text-slate-400">No context files registered.</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Use <code className="bg-slate-100 px-1 rounded">agentfloor push</code> to sync CLAUDE.md and other context.
                      </p>
                    </div>
                  )}
                </>
              )}

              {activeTab === "usage" && (
                <>
                  {/* Usage Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Cost</div>
                      <div className="text-base font-bold text-slate-900 mt-0.5">
                        {formatCurrency(agent.monthlyCost)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Tokens</div>
                      <div className="text-base font-bold text-slate-900 mt-0.5">
                        {formatTokens(agent.tokensUsed)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Requests</div>
                      <div className="text-base font-bold text-slate-900 mt-0.5">
                        {totalRequests.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Usage Chart */}
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Token Usage (7 days)
                    </h3>
                    <UsageBarChart data={agent.usageHistory} />
                  </div>

                  {/* Metadata */}
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Metadata
                    </h3>
                    <div className="rounded-xl bg-slate-50 p-3 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Created</span>
                        <span className="text-slate-700 font-medium">{new Date(agent.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Last Active</span>
                        <span className="text-slate-700 font-medium">{timeAgo(agent.lastActive)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Department</span>
                        <span className="text-slate-700 font-medium">{department?.name ?? "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Model</span>
                        <span className="text-slate-700 font-medium">{agent.model}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Vendor</span>
                        <span className="text-slate-700 font-medium capitalize">{agent.vendor}</span>
                      </div>
                      {agent.registeredByMember && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Registered by</span>
                          <span className="text-slate-700 font-medium">
                            {agent.registeredByMember.name}
                            {agent.registeredByMember.email && (
                              <span className="text-slate-400 font-normal ml-1">({agent.registeredByMember.email})</span>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

"use client";

import Link from "next/link";
import { useAppStore } from "@/stores/app-store";
import { useOrgId } from "@/hooks/useOrgId";
import { getVendorColor, getVendorLabel, cn } from "@/lib/utils";
import type { Agent } from "@/types";

export default function OverviewPage() {
  const orgId = useOrgId();
  const organization = useAppStore((s) => s.organization);

  const allAgents: (Agent & { departmentName: string })[] =
    organization.departments.flatMap((d) =>
      d.agents.map((a) => ({ ...a, departmentName: d.name })),
    );

  // Top Skills — count agents per skill
  const skillCount = new Map<string, { name: string; category: string; icon: string; count: number }>();
  for (const agent of allAgents) {
    for (const skill of agent.skills) {
      const existing = skillCount.get(skill.name);
      if (existing) {
        existing.count += 1;
      } else {
        skillCount.set(skill.name, {
          name: skill.name,
          category: skill.category,
          icon: skill.icon,
          count: 1,
        });
      }
    }
  }
  const topSkills = Array.from(skillCount.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top MCP Tools — count agents per tool
  const mcpCount = new Map<string, { name: string; server: string; icon: string; category: string; count: number }>();
  for (const agent of allAgents) {
    for (const tool of agent.mcpTools) {
      const existing = mcpCount.get(tool.name);
      if (existing) {
        existing.count += 1;
      } else {
        mcpCount.set(tool.name, {
          name: tool.name,
          server: tool.server,
          icon: tool.icon,
          category: tool.category,
          count: 1,
        });
      }
    }
  }
  const topMcpTools = Array.from(mcpCount.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Featured Agents — by total skills + MCP tools count
  const featuredAgents = [...allAgents]
    .sort((a, b) => (b.skills.length + b.mcpTools.length) - (a.skills.length + a.mcpTools.length))
    .slice(0, 8);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href={`/org/${orgId}`}
            className="rounded-lg bg-white px-3 py-1.5 text-sm shadow-sm hover:bg-gray-100"
          >
            &larr; Back to Map
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
          <span className="text-sm text-gray-500">
            {allAgents.length} agents across {organization.departments.length} departments
          </span>
        </div>

        {/* Top Skills */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Top Skills
          </h2>
          {topSkills.length === 0 ? (
            <p className="text-sm text-gray-400">No skills registered yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topSkills.map((skill, i) => (
                <div
                  key={skill.name}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3",
                    i < 3 ? "border-blue-200 bg-blue-50" : "border-gray-100 bg-gray-50",
                  )}
                >
                  <span className="text-xl">{skill.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {skill.name}
                    </p>
                    <p className="text-xs text-gray-500">{skill.category}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                      i < 3
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-200 text-gray-600",
                    )}
                  >
                    {skill.count} agent{skill.count !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top MCP Tools */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Top MCP Tools
          </h2>
          {topMcpTools.length === 0 ? (
            <p className="text-sm text-gray-400">No MCP tools registered yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topMcpTools.map((tool, i) => (
                <div
                  key={tool.name}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3",
                    i < 3 ? "border-purple-200 bg-purple-50" : "border-gray-100 bg-gray-50",
                  )}
                >
                  <span className="text-xl">{tool.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {tool.name}
                    </p>
                    <p className="text-xs text-gray-500">{tool.server}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                      i < 3
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-200 text-gray-600",
                    )}
                  >
                    {tool.count} agent{tool.count !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Featured Agents */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Featured Agents
          </h2>
          {featuredAgents.length === 0 ? (
            <p className="text-sm text-gray-400">No agents registered yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {featuredAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="rounded-lg border border-gray-100 bg-gray-50 p-4"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        agent.status === "active"
                          ? "bg-green-500"
                          : agent.status === "idle"
                            ? "bg-yellow-400"
                            : "bg-red-500",
                      )}
                    />
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {agent.name}
                    </p>
                  </div>
                  <p className="mb-3 text-xs text-gray-500">{agent.departmentName}</p>
                  <div className="mb-2">
                    <span
                      className="inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: getVendorColor(agent.vendor) }}
                    >
                      {getVendorLabel(agent.vendor)} / {agent.model}
                    </span>
                  </div>
                  <div className="flex gap-3 text-xs text-gray-500">
                    <span>{agent.skills.length} skills</span>
                    <span>{agent.mcpTools.length} MCP tools</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

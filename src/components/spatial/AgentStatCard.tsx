"use client";

import React, { useEffect, useState } from "react";
import { useAppStore } from "@/stores/app-store";
import { getVendorColor, getVendorLabel } from "@/lib/utils";
import type { Agent } from "@/types";

/** Format large numbers: 128000 → "128K", 1500000 → "1.5M" */
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/** Relative time: "2m ago", "3h ago", "1d ago" */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function MetricRow({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span
        className="text-gray-500 uppercase tracking-wider"
        style={{ fontFamily: '"Press Start 2P", monospace', fontSize: "6px" }}
      >
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <span
          className="text-gray-200"
          style={{ fontFamily: '"Press Start 2P", monospace', fontSize: "7px", color: color ?? "#E2E8F0" }}
        >
          {value}
        </span>
        {sub && (
          <span
            className="text-gray-600"
            style={{ fontFamily: '"Press Start 2P", monospace', fontSize: "6px" }}
          >
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ value, max, color, showLabel }: { value: number; max: number; color: string; showLabel?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="relative w-full h-[8px] bg-gray-800 border border-gray-700">
      <div
        className="h-full transition-all duration-500"
        style={{
          width: `${pct}%`,
          backgroundColor: color,
          boxShadow: `0 0 4px ${color}66`,
        }}
      />
      {showLabel && (
        <span
          className="absolute inset-0 flex items-center justify-center text-white"
          style={{ fontFamily: '"Press Start 2P", monospace', fontSize: "5px", textShadow: "0 0 2px #000" }}
        >
          {showLabel}
        </span>
      )}
    </div>
  );
}

function AgentSprite({ agent }: { agent: Agent }) {
  const vendorColor = getVendorColor(agent.vendor);
  const initial = agent.name.charAt(0).toUpperCase();
  return (
    <div
      className="w-12 h-12 flex items-center justify-center border-2 font-mono font-bold text-white"
      style={{
        backgroundColor: `${vendorColor}22`,
        borderColor: vendorColor,
        boxShadow: `0 0 8px ${vendorColor}55, inset 0 0 8px ${vendorColor}22`,
        fontFamily: '"Press Start 2P", monospace',
        fontSize: "14px",
        imageRendering: "pixelated",
      }}
    >
      {initial}
    </div>
  );
}

function StatusBadge({ status }: { status: Agent["status"] }) {
  const config = {
    active: { color: "#22C55E", bg: "#22C55E22", label: "ACTIVE" },
    idle: { color: "#EAB308", bg: "#EAB30822", label: "IDLE" },
    error: { color: "#EF4444", bg: "#EF444422", label: "ERROR" },
  }[status];
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-0.5 border"
      style={{ borderColor: `${config.color}66`, backgroundColor: config.bg }}
    >
      <div
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: config.color, boxShadow: `0 0 4px ${config.color}` }}
      />
      <span style={{ fontFamily: '"Press Start 2P", monospace', fontSize: "6px", color: config.color }}>
        {config.label}
      </span>
    </div>
  );
}

interface AgentStatCardProps {
  hoveredAgentId?: string | null;
}

export default function AgentStatCard({ hoveredAgentId }: AgentStatCardProps) {
  const selectedAgentId = useAppStore((s) => s.selectedAgentId);
  const organization = useAppStore((s) => s.organization);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const [visible, setVisible] = useState(false);
  const [agent, setAgent] = useState<Agent | null>(null);

  // Show stat card for hovered or selected agent (hovered takes visual priority)
  const activeId = hoveredAgentId ?? selectedAgentId;

  useEffect(() => {
    if (activeId) {
      // Find agent by ID across all departments
      let found: Agent | null = null;
      for (const dept of organization.departments) {
        const a = dept.agents.find((ag) => ag.id === activeId);
        if (a) { found = a; break; }
      }
      setAgent(found);
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      const t = setTimeout(() => setAgent(null), 250);
      return () => clearTimeout(t);
    }
  }, [activeId, organization]);

  if (!agent) return null;

  const vendorColor = getVendorColor(agent.vendor);
  const avgDailyRequests = agent.usageHistory.length > 0
    ? Math.round(agent.usageHistory.reduce((s, d) => s + d.requests, 0) / agent.usageHistory.length)
    : 0;
  const totalSkills = agent.skills.length;
  const totalTools = agent.mcpTools.length;

  return (
    <div
      className="absolute bottom-32 left-4 z-20 pointer-events-auto select-none"
      style={{
        width: "230px",
        transition: "opacity 0.2s ease, transform 0.2s ease",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
      }}
    >
      <div
        className="bg-gray-900/95 border-2 border-gray-600"
        style={{ boxShadow: "4px 4px 0px 0px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.04)" }}
      >
        {/* Vendor accent stripe */}
        <div style={{ height: "3px", backgroundColor: vendorColor }} />

        {/* Header: sprite + name + close */}
        <div className="flex items-center gap-2 px-3 pt-2 pb-1.5">
          <AgentSprite agent={agent} />
          <div className="flex-1 min-w-0">
            <div
              className="text-white truncate leading-tight"
              style={{ fontFamily: '"Press Start 2P", monospace', fontSize: "8px" }}
            >
              {agent.name}
            </div>
            <div
              className="text-gray-500 truncate mt-1"
              style={{ fontFamily: '"Press Start 2P", monospace', fontSize: "6px" }}
            >
              {agent.model}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <div
                className="inline-block px-1 py-px"
                style={{
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: "6px",
                  backgroundColor: `${vendorColor}22`,
                  color: vendorColor,
                  border: `1px solid ${vendorColor}66`,
                }}
              >
                {getVendorLabel(agent.vendor)}
              </div>
              <StatusBadge status={agent.status} />
            </div>
          </div>
          <button
            className="text-gray-500 hover:text-gray-200 text-xs leading-none self-start"
            style={{ fontFamily: "monospace" }}
            onClick={() => selectAgent(null)}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Divider */}
        <div className="mx-3 border-t border-gray-700/60 my-1.5" />

        {/* Real Metrics */}
        <div className="px-3 flex flex-col gap-2 pb-2">
          <MetricRow
            label="Tokens Used"
            value={formatTokens(agent.tokensUsed)}
            sub="total"
          />
          <MetricRow
            label="Throughput"
            value={String(avgDailyRequests)}
            sub="req/day"
          />
          <MetricRow
            label="Skills"
            value={String(totalSkills)}
            sub={totalSkills === 1 ? "skill" : "skills"}
            color="#A855F7"
          />
          <MetricRow
            label="MCP Tools"
            value={String(totalTools)}
            sub={totalTools === 1 ? "tool" : "tools"}
            color="#3B82F6"
          />
          <MetricRow
            label="Cost"
            value={`$${agent.monthlyCost}`}
            sub="/mo"
            color="#EAB308"
          />
          <MetricRow
            label="Last Active"
            value={relativeTime(agent.lastActive)}
          />
        </div>

        {/* Skills icons */}
        {totalSkills > 0 && (
          <>
            <div className="mx-3 border-t border-gray-700/60 mb-1.5" />
            <div className="px-3 pb-2.5">
              <div
                className="text-gray-500 uppercase tracking-wider mb-1"
                style={{ fontFamily: '"Press Start 2P", monospace', fontSize: "6px" }}
              >
                Equipped Skills
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {agent.skills.slice(0, 10).map((skill) => (
                  <span
                    key={skill.id}
                    title={skill.name}
                    className="text-[10px] bg-gray-800 border border-gray-700 px-1 py-0.5 leading-none cursor-default"
                  >
                    {skill.icon}
                  </span>
                ))}
                {totalSkills > 10 && (
                  <span
                    className="text-gray-600"
                    style={{ fontFamily: '"Press Start 2P", monospace', fontSize: "6px" }}
                  >
                    +{totalSkills - 10}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

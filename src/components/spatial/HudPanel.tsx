"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/stores/app-store";
import { getVendorColor, getVendorLabel, cn } from "@/lib/utils";
import type { Agent, Organization } from "@/types";
import type { Viewport } from "pixi-viewport";

interface HudPanelProps {
  organization: Organization;
  selectedAgent: Agent | null;
  viewportRef: React.RefObject<Viewport | null>;
  orgId: string;
  recentAgentIds?: string[];
}

/**
 * Sprite sheet: /assets/characters.png (384x672)
 * 12 columns x 21 rows of 32x32 sprites.
 * Each row: 4 characters × 3 frames each (stand, walk-left, walk-right).
 * Character pool: col 0 (front-facing) from rows 1-20.
 */
const SPRITE_SIZE = 32;
const CHARS_PER_ROW = 4;
const FRAMES_PER_CHAR = 3;
const TOTAL_ROWS = 21;
const CHARACTER_POOL = Array.from({ length: TOTAL_ROWS - 1 }, (_, i) => (i + 1) * CHARS_PER_ROW);

function spriteNameHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Get CSS background-position to show a specific character's standing frame */
function getSpritePosition(agentName: string): { x: number; y: number } {
  const hash = spriteNameHash(agentName);
  const charIndex = CHARACTER_POOL[hash % CHARACTER_POOL.length];
  const charCol = charIndex % CHARS_PER_ROW;
  const charRow = Math.floor(charIndex / CHARS_PER_ROW);
  const pixelX = charCol * FRAMES_PER_CHAR * SPRITE_SIZE;
  const pixelY = charRow * SPRITE_SIZE;
  return { x: -pixelX, y: -pixelY };
}

/** Pixel-art sprite portrait from the character sheet */
function SpritePortrait({ agentName, size = 40 }: { agentName: string; size?: number }) {
  const pos = getSpritePosition(agentName);
  const scale = size / SPRITE_SIZE;
  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundImage: "url(/assets/characters.png)",
        backgroundPosition: `${pos.x * scale}px ${pos.y * scale}px`,
        backgroundSize: `${384 * scale}px ${672 * scale}px`,
        imageRendering: "pixelated",
      }}
    />
  );
}

/** Format large numbers: 128000 → "128K" */
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function StatusDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
      style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}88` }}
    />
  );
}

/** Stacked bar showing active/idle/error proportions */
function SupplyBar({ active, idle, error }: { active: number; idle: number; error: number }) {
  const total = active + idle + error;
  if (total === 0) return <div className="h-[6px] w-full bg-gray-800 border border-gray-700" />;
  const aPct = (active / total) * 100;
  const iPct = (idle / total) * 100;
  const ePct = (error / total) * 100;
  return (
    <div className="h-[6px] w-full bg-gray-800 border border-gray-700 flex overflow-hidden">
      {aPct > 0 && <div style={{ width: `${aPct}%`, backgroundColor: "#22C55E" }} />}
      {iPct > 0 && <div style={{ width: `${iPct}%`, backgroundColor: "#EAB308" }} />}
      {ePct > 0 && <div style={{ width: `${ePct}%`, backgroundColor: "#EF4444" }} />}
    </div>
  );
}

function BudgetBar({ spent, budget }: { spent: number; budget: number }) {
  if (budget <= 0) return null;
  const pct = Math.min(100, (spent / budget) * 100);
  const isOver = pct >= 90;
  const color = isOver ? "#EF4444" : "#3B82F6";
  return (
    <div className="relative h-[6px] w-full bg-gray-800 border border-gray-700">
      <div
        className="h-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 3px ${color}44` }}
      />
    </div>
  );
}

/** Small agent portrait tile with sprite avatar */
function AgentTile({ agent, size, onClick }: { agent: Agent; size: number; onClick: () => void }) {
  const vendorColor = getVendorColor(agent.vendor);
  const statusColor = agent.status === "active" ? "#22C55E" : agent.status === "idle" ? "#EAB308" : "#EF4444";

  return (
    <button
      onClick={onClick}
      title={`${agent.name} (${agent.status})`}
      className="relative cursor-pointer transition-transform hover:scale-110 hover:z-10 shrink-0"
      style={{
        width: size,
        height: size,
        border: `2px solid ${vendorColor}88`,
        backgroundColor: "#111827",
        overflow: "hidden",
      }}
    >
      <SpritePortrait agentName={agent.name} size={size - 4} />
      {/* Status dot */}
      <span
        className="absolute rounded-full border border-gray-900"
        style={{
          backgroundColor: statusColor,
          width: size > 32 ? 7 : 5,
          height: size > 32 ? 7 : 5,
          bottom: -1,
          right: -1,
        }}
      />
    </button>
  );
}

/** Recent agent portrait — larger, with name label */
function RecentAgentPortrait({ agent, onClick }: { agent: Agent; onClick: () => void }) {
  const vendorColor = getVendorColor(agent.vendor);
  const statusColor = agent.status === "active" ? "#22C55E" : agent.status === "idle" ? "#EAB308" : "#EF4444";

  return (
    <button
      onClick={onClick}
      title={agent.name}
      className="flex flex-col items-center gap-1 cursor-pointer transition-transform hover:scale-105 shrink-0"
    >
      <div
        className="relative"
        style={{
          width: 48,
          height: 48,
          border: `2px solid ${vendorColor}`,
          backgroundColor: "#111827",
          boxShadow: `0 0 8px ${vendorColor}44`,
          overflow: "hidden",
        }}
      >
        <SpritePortrait agentName={agent.name} size={44} />
        <span
          className="absolute bottom-0 right-0 w-[7px] h-[7px] rounded-full border border-gray-900"
          style={{ backgroundColor: statusColor }}
        />
      </div>
      <span
        className="truncate text-center max-w-[56px]"
        style={{ fontFamily: '"Press Start 2P", monospace', fontSize: "5px", color: vendorColor }}
      >
        {agent.name}
      </span>
    </button>
  );
}

/** Center panel — recent agent portraits + agent grid */
function FleetSummaryCenter({ organization, recentAgentIds }: { organization: Organization; recentAgentIds: string[] }) {
  const selectAgent = useAppStore((s) => s.selectAgent);
  const allAgents = organization.departments.flatMap((d) => d.agents);

  // Resolve recent agents
  const recentAgents: Agent[] = [];
  for (const id of recentAgentIds) {
    const found = allAgents.find((a) => a.id === id);
    if (found) recentAgents.push(found);
  }

  // Remaining agents (not in recent) for the smaller grid
  const recentSet = new Set(recentAgentIds);
  const otherAgents = allAgents.filter((a) => !recentSet.has(a.id));

  // Sort others: error first, then active, then idle
  const statusOrder: Record<string, number> = { error: 0, active: 1, idle: 2 };
  otherAgents.sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3));

  return (
    <div className="flex items-center gap-4 overflow-hidden h-full">
      {/* Recent agents — large portraits */}
      {recentAgents.length > 0 && (
        <div className="flex flex-col gap-1 shrink-0">
          <span
            className="text-amber-400 uppercase tracking-widest"
            style={{ fontFamily: '"Press Start 2P", monospace', fontSize: "6px" }}
          >
            RECENT
          </span>
          <div className="flex items-center gap-2">
            {recentAgents.map((a) => (
              <RecentAgentPortrait key={a.id} agent={a} onClick={() => selectAgent(a.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      {recentAgents.length > 0 && otherAgents.length > 0 && (
        <div className="w-px h-14 bg-gray-700 shrink-0" />
      )}

      {/* Other agents — smaller tile grid */}
      {otherAgents.length > 0 && (
        <div className="flex flex-wrap gap-1 content-start max-h-[76px] overflow-hidden">
          {otherAgents.map((agent) => (
            <AgentTile
              key={agent.id}
              agent={agent}
              size={28}
              onClick={() => selectAgent(agent.id)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {allAgents.length === 0 && (
        <div className="flex items-center justify-center w-full">
          <span className="text-gray-600 font-mono text-[9px] italic">No agents registered</span>
        </div>
      )}
    </div>
  );
}

export default function HudPanel({ organization, selectedAgent, viewportRef, orgId, recentAgentIds = [] }: HudPanelProps) {
  const router = useRouter();
  const selectAgent = useAppStore((s) => s.selectAgent);

  const allAgents = organization.departments.flatMap((d) => d.agents);
  const totalAgents = allAgents.length;
  const activeCount = allAgents.filter((a) => a.status === "active").length;
  const idleCount = allAgents.filter((a) => a.status === "idle").length;
  const errorCount = allAgents.filter((a) => a.status === "error").length;
  const totalSpend = organization.departments.reduce((sum, d) => sum + d.monthlySpend, 0);
  const totalBudget = organization.totalBudget;
  const deptCount = organization.departments.length;

  const buttonClass =
    "flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 bg-gray-900 border-2 border-gray-600 text-gray-300 hover:bg-gray-800 hover:border-amber-700 hover:text-amber-200 transition-colors font-mono text-[9px] leading-tight shadow-[2px_2px_0px_0px_rgba(0,0,0,0.6)] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] cursor-pointer select-none min-w-[60px]";

  const handleChat = () => {
    if (selectedAgent) router.push(`/org/${orgId}/chat`);
  };
  const handleDetails = () => {
    if (selectedAgent) selectAgent(selectedAgent.id);
  };
  const handleInspect = () => {
    if (!selectedAgent || !viewportRef.current) return;
    viewportRef.current.animate({
      position: { x: selectedAgent.position.x, y: selectedAgent.position.y },
      scale: 2.5,
      time: 500,
      ease: "easeInOutSine",
    });
  };

  const vendorColor = selectedAgent ? getVendorColor(selectedAgent.vendor) : "#F5E6D0";

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-20 flex"
      style={{
        height: 100,
        background: "rgba(10,10,14,0.97)",
        borderTop: "2px solid #4B5563",
        boxShadow: "0 -3px 0 0 rgba(0,0,0,0.6)",
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.012) 3px, rgba(255,255,255,0.012) 4px)`,
      }}
    >
      {/* ── Left: Fleet Overview ─────────────────────────── */}
      <div
        className="flex flex-col justify-center gap-1.5 px-4"
        style={{ width: 210, borderRight: "1px dashed #374151", flexShrink: 0 }}
      >
        <div
          className="text-amber-400 uppercase tracking-widest mb-0.5"
          style={{ fontFamily: '"Press Start 2P", monospace', fontSize: "7px" }}
        >
          FLEET
        </div>

        {/* Agent supply bar + counts */}
        <div className="flex items-center gap-2">
          <span
            className="text-white shrink-0"
            style={{ fontFamily: '"Press Start 2P", monospace', fontSize: "8px" }}
          >
            {totalAgents}
          </span>
          <span className="text-gray-600 text-[8px] font-mono shrink-0">agents</span>
          <div className="flex items-center gap-1.5 ml-auto">
            <div className="flex items-center gap-0.5">
              <StatusDot color="#22C55E" />
              <span className="text-green-400 font-mono text-[8px]">{activeCount}</span>
            </div>
            <div className="flex items-center gap-0.5">
              <StatusDot color="#EAB308" />
              <span className="text-yellow-400 font-mono text-[8px]">{idleCount}</span>
            </div>
            {errorCount > 0 && (
              <div className="flex items-center gap-0.5">
                <StatusDot color="#EF4444" />
                <span className="text-red-400 font-mono text-[8px]">{errorCount}</span>
              </div>
            )}
          </div>
        </div>
        <SupplyBar active={activeCount} idle={idleCount} error={errorCount} />

        {/* Budget */}
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[8px] text-gray-400">
            <span className="text-white">${totalSpend.toLocaleString()}</span>
            {totalBudget > 0 && (
              <span className="text-gray-600"> / ${totalBudget.toLocaleString()}</span>
            )}
          </span>
          <span className="text-gray-600 font-mono text-[7px] ml-auto">{deptCount} depts</span>
        </div>
        {totalBudget > 0 && <BudgetBar spent={totalSpend} budget={totalBudget} />}
      </div>

      {/* ── Center: Selected Agent Info ───────────────── */}
      <div className="flex-1 flex flex-col justify-center px-5 overflow-hidden">
        {selectedAgent ? (
          <div className="flex items-center gap-4">
            {/* Agent identity */}
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="font-bold truncate"
                  style={{ fontFamily: '"Press Start 2P", monospace', fontSize: "10px", color: vendorColor }}
                >
                  {selectedAgent.name}
                </span>
                <span
                  className="shrink-0 px-1.5 py-0.5 border"
                  style={{
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize: "6px",
                    color: vendorColor,
                    borderColor: `${vendorColor}66`,
                  }}
                >
                  {getVendorLabel(selectedAgent.vendor)}
                </span>
                {/* Status badge */}
                <span
                  className="shrink-0 px-1.5 py-0.5 border"
                  style={{
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize: "6px",
                    color: selectedAgent.status === "active" ? "#22C55E" : selectedAgent.status === "idle" ? "#EAB308" : "#EF4444",
                    borderColor: selectedAgent.status === "active" ? "#22C55E66" : selectedAgent.status === "idle" ? "#EAB30866" : "#EF444466",
                    backgroundColor: selectedAgent.status === "active" ? "#22C55E11" : selectedAgent.status === "idle" ? "#EAB30811" : "#EF444411",
                  }}
                >
                  {selectedAgent.status.toUpperCase()}
                </span>
              </div>
              <span className="text-gray-500 font-mono text-[8px] truncate">
                {selectedAgent.model}
              </span>
            </div>

            {/* Vertical divider */}
            <div className="w-px h-12 bg-gray-700 shrink-0" />

            {/* Real metrics grid */}
            <div className="grid grid-cols-2 gap-x-5 gap-y-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-gray-600 font-mono text-[7px] uppercase w-12">Tokens</span>
                <span className="text-gray-200 font-mono text-[9px]">{formatTokens(selectedAgent.tokensUsed)}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-gray-600 font-mono text-[7px] uppercase w-12">Cost</span>
                <span className="text-yellow-300 font-mono text-[9px]">${selectedAgent.monthlyCost}/mo</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-gray-600 font-mono text-[7px] uppercase w-12">Skills</span>
                <span className="text-purple-300 font-mono text-[9px]">{selectedAgent.skills.length}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-gray-600 font-mono text-[7px] uppercase w-12">Tools</span>
                <span className="text-blue-300 font-mono text-[9px]">{selectedAgent.mcpTools.length}</span>
              </div>
            </div>

            {/* Skill icons */}
            {selectedAgent.skills.length > 0 && (
              <>
                <div className="w-px h-12 bg-gray-700 shrink-0" />
                <div className="flex items-center gap-1 flex-wrap">
                  {selectedAgent.skills.slice(0, 6).map((skill) => (
                    <span
                      key={skill.id}
                      title={skill.name}
                      className="text-[10px] bg-gray-800 border border-gray-700 px-1 py-0.5 leading-none cursor-default"
                    >
                      {skill.icon}
                    </span>
                  ))}
                  {selectedAgent.skills.length > 6 && (
                    <span className="text-gray-600 font-mono text-[7px]">
                      +{selectedAgent.skills.length - 6}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <FleetSummaryCenter organization={organization} recentAgentIds={recentAgentIds} />
        )}
      </div>

      {/* ── Right: Command Buttons ─────────────────────── */}
      <div
        className="flex flex-col justify-center gap-1.5 px-4"
        style={{ width: 200, borderLeft: "1px dashed #374151", flexShrink: 0 }}
      >
        <div
          className="text-amber-400 uppercase tracking-widest mb-0.5"
          style={{ fontFamily: '"Press Start 2P", monospace', fontSize: "7px" }}
        >
          COMMANDS
        </div>
        <div className="grid grid-cols-3 gap-1">
          <button
            className={cn(buttonClass, !selectedAgent && "opacity-30 pointer-events-none")}
            onClick={handleChat}
            title="Open chat with this agent"
          >
            <span className="text-[12px]">💬</span>
            <span>CHAT</span>
          </button>
          <button
            className={cn(buttonClass, !selectedAgent && "opacity-30 pointer-events-none")}
            onClick={handleDetails}
            title="View agent details"
          >
            <span className="text-[12px]">📋</span>
            <span>INFO</span>
          </button>
          <button
            className={cn(buttonClass, !selectedAgent && "opacity-30 pointer-events-none")}
            onClick={handleInspect}
            title="Zoom to agent on map"
          >
            <span className="text-[12px]">🔍</span>
            <span>ZOOM</span>
          </button>
        </div>
      </div>
    </div>
  );
}

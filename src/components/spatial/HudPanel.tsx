"use client";

import React from "react";
import { useAppStore } from "@/stores/app-store";
import { getVendorColor } from "@/lib/utils";
import type { Agent, Organization } from "@/types";

interface HudPanelProps {
  organization: Organization;
  orgId: string;
  recentAgentIds?: string[];
}

/**
 * Pixel-character sprites: /assets/pixel-characters/char_0..5.png
 * Each PNG is 112x96 (7 frames × 16px wide, 3 rows × 32px tall).
 * Standing frame = column 1 (index 1), facing down = row 0.
 * 6 base palettes; hash agent name to pick one.
 */
const SPRITE_WIDTH = 16;
const SPRITE_HEIGHT = 32;
const SHEET_WIDTH = 112; // 7 frames × 16px
const SHEET_HEIGHT = 96; // 3 rows × 32px
const STANDING_FRAME = 1;
const DOWN_ROW = 0;
const PALETTE_COUNT = 6;

function spriteNameHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Pixel-art sprite portrait from a pixel-character sheet.
 *  `width` controls the display width; height is always 2× width (16:32 ratio).
 */
function SpritePortrait({ agentName, width = 40 }: { agentName: string; width?: number }) {
  const paletteIndex = spriteNameHash(agentName) % PALETTE_COUNT;
  const displayH = width * (SPRITE_HEIGHT / SPRITE_WIDTH); // 2:1
  const scaleX = width / SPRITE_WIDTH;
  const scaleY = displayH / SPRITE_HEIGHT;
  const posX = -(STANDING_FRAME * SPRITE_WIDTH) * scaleX;
  const posY = -(DOWN_ROW * SPRITE_HEIGHT) * scaleY;
  return (
    <div
      style={{
        width,
        height: displayH,
        backgroundImage: `url(/assets/pixel-characters/char_${paletteIndex}.png)`,
        backgroundPosition: `${posX}px ${posY}px`,
        backgroundSize: `${SHEET_WIDTH * scaleX}px ${SHEET_HEIGHT * scaleY}px`,
        imageRendering: "pixelated",
      }}
    />
  );
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
        className="relative flex items-center justify-center"
        style={{
          width: 48,
          height: 64,
          border: `2px solid ${vendorColor}`,
          backgroundColor: "#111827",
          boxShadow: `0 0 8px ${vendorColor}44`,
          overflow: "hidden",
        }}
      >
        <SpritePortrait agentName={agent.name} width={28} />
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

export default function HudPanel({ organization, orgId, recentAgentIds = [] }: HudPanelProps) {
  const selectAgent = useAppStore((s) => s.selectAgent);

  const allAgents = organization.departments.flatMap((d) => d.agents);
  const totalAgents = allAgents.length;
  const activeCount = allAgents.filter((a) => a.status === "active").length;
  const idleCount = allAgents.filter((a) => a.status === "idle").length;
  const errorCount = allAgents.filter((a) => a.status === "error").length;
  const totalSpend = organization.departments.reduce((sum, d) => sum + d.monthlySpend, 0);
  const totalBudget = organization.totalBudget;

  // Resolve recent agents
  const recentAgents: Agent[] = [];
  for (const id of recentAgentIds) {
    const found = allAgents.find((a) => a.id === id);
    if (found) recentAgents.push(found);
  }

  // Burn rate: simple daily estimate from monthly
  const dailyBurn = totalSpend / 30;

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-20 flex items-center"
      style={{
        height: 80,
        background: "rgba(10,10,14,0.97)",
        borderTop: "2px solid #4B5563",
        boxShadow: "0 -3px 0 0 rgba(0,0,0,0.6)",
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.012) 3px, rgba(255,255,255,0.012) 4px)`,
      }}
    >
      {/* ── Cost & Budget ─────────────────────────── */}
      <div
        className="flex flex-col justify-center gap-1.5 px-5 h-full"
        style={{ width: 220, borderRight: "1px dashed #374151", flexShrink: 0 }}
      >
        <div
          className="text-amber-400 uppercase tracking-widest"
          style={{ fontFamily: '"Press Start 2P", monospace', fontSize: "7px" }}
        >
          BUDGET
        </div>

        {/* Spend / Budget */}
        <div className="flex items-baseline gap-1.5">
          <span
            className="text-white"
            style={{ fontFamily: '"Press Start 2P", monospace', fontSize: "10px" }}
          >
            ${totalSpend.toLocaleString()}
          </span>
          {totalBudget > 0 && (
            <span className="text-gray-600 font-mono text-[8px]">
              / ${totalBudget.toLocaleString()}
            </span>
          )}
          <span className="text-gray-600 font-mono text-[7px]">/mo</span>
        </div>
        {totalBudget > 0 && <BudgetBar spent={totalSpend} budget={totalBudget} />}

        {/* Burn rate */}
        <div className="flex items-center gap-1">
          <span className="text-gray-500 font-mono text-[7px]">burn</span>
          <span className="text-orange-400 font-mono text-[8px]">
            ~${dailyBurn.toFixed(0)}/day
          </span>
        </div>
      </div>

      {/* ── Fleet Status ─────────────────────────── */}
      <div
        className="flex flex-col justify-center gap-1.5 px-5 h-full"
        style={{ width: 200, borderRight: "1px dashed #374151", flexShrink: 0 }}
      >
        <div
          className="text-amber-400 uppercase tracking-widest"
          style={{ fontFamily: '"Press Start 2P", monospace', fontSize: "7px" }}
        >
          AGENTS
        </div>

        {/* Active ratio */}
        <div className="flex items-center gap-2">
          <span
            className="text-white"
            style={{ fontFamily: '"Press Start 2P", monospace', fontSize: "10px" }}
          >
            {activeCount}
            <span className="text-gray-600 text-[8px]"> / {totalAgents}</span>
          </span>
          <span className="text-green-400 font-mono text-[7px]">active</span>
        </div>

        <SupplyBar active={activeCount} idle={idleCount} error={errorCount} />

        {/* Status counts */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            <StatusDot color="#22C55E" />
            <span className="text-green-400 font-mono text-[7px]">{activeCount}</span>
          </div>
          <div className="flex items-center gap-0.5">
            <StatusDot color="#EAB308" />
            <span className="text-yellow-400 font-mono text-[7px]">{idleCount}</span>
          </div>
          {errorCount > 0 && (
            <div className="flex items-center gap-0.5">
              <StatusDot color="#EF4444" />
              <span className="text-red-400 font-mono text-[7px]">{errorCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Agents ────────────────────────── */}
      <div className="flex flex-col justify-center gap-1 px-5 h-full flex-1 overflow-hidden">
        <div
          className="text-amber-400 uppercase tracking-widest"
          style={{ fontFamily: '"Press Start 2P", monospace', fontSize: "7px" }}
        >
          RECENT
        </div>

        {recentAgents.length > 0 ? (
          <div className="flex items-center gap-3">
            {recentAgents.map((a) => (
              <RecentAgentPortrait key={a.id} agent={a} onClick={() => selectAgent(a.id)} />
            ))}
          </div>
        ) : (
          <span
            className="text-gray-600 italic"
            style={{ fontFamily: '"Press Start 2P", monospace', fontSize: "6px" }}
          >
            Click an agent to interact
          </span>
        )}
      </div>
    </div>
  );
}

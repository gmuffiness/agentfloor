"use client";

import React, { useRef, useEffect, useCallback } from "react";
import type { Department, Agent } from "@/types";
import { getVendorColor } from "@/lib/utils";

interface MinimapProps {
  departments: Department[];
  worldWidth: number;
  worldHeight: number;
  getViewportBounds: () => { x: number; y: number; width: number; height: number } | null;
}

const MINIMAP_W = 180;
const MINIMAP_H = 120;

/** Convert hex color string to rgba string with alpha */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Status dot colors */
const STATUS_COLORS: Record<string, string> = {
  active: "#22C55E",
  idle: "#EAB308",
  error: "#EF4444",
};

export default function Minimap({ departments, worldWidth, worldHeight, getViewportBounds }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  const scaleX = MINIMAP_W / worldWidth;
  const scaleY = MINIMAP_H / worldHeight;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, MINIMAP_W, MINIMAP_H);

    // Background
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, MINIMAP_W, MINIMAP_H);

    // Draw department rooms
    for (const dept of departments) {
      const { x, y, width, height } = dept.layout;
      const mx = x * scaleX;
      const my = y * scaleY;
      const mw = width * scaleX;
      const mh = height * scaleY;

      const vendorColor = getVendorColor(dept.primaryVendor);
      ctx.fillStyle = hexToRgba(vendorColor, 0.25);
      ctx.fillRect(mx, my, mw, mh);

      ctx.strokeStyle = hexToRgba(vendorColor, 0.8);
      ctx.lineWidth = 1;
      ctx.strokeRect(mx, my, mw, mh);
    }

    // Draw agents as dots
    for (const dept of departments) {
      for (const agent of dept.agents) {
        const ax = agent.position.x * scaleX;
        const ay = agent.position.y * scaleY;
        const dotColor = STATUS_COLORS[agent.status] ?? "#9CA3AF";

        ctx.beginPath();
        ctx.arc(ax, ay, 2, 0, Math.PI * 2);
        ctx.fillStyle = dotColor;
        ctx.fill();
      }
    }

    // Draw viewport rect
    const vp = getViewportBounds();
    if (vp) {
      const vx = vp.x * scaleX;
      const vy = vp.y * scaleY;
      const vw = vp.width * scaleX;
      const vh = vp.height * scaleY;

      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(vx, vy, vw, vh);

      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1;
      ctx.strokeRect(vx, vy, vw, vh);
    }

    rafRef.current = requestAnimationFrame(draw);
  }, [departments, scaleX, scaleY, getViewportBounds]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Convert minimap coords to world coords
      const worldX = mx / scaleX;
      const worldY = my / scaleY;

      // Use the shared viewport to move camera
      // Import getViewport lazily to avoid circular dep at module level
      import("./SpatialCanvas").then(({ getViewport }) => {
        const vp = getViewport();
        if (vp) {
          vp.animate({
            position: { x: worldX, y: worldY },
            time: 300,
            ease: "easeInOutSine",
          });
        }
      });
    },
    [scaleX, scaleY],
  );

  return (
    <div
      className="absolute right-4 z-10"
      style={{ bottom: 220, width: MINIMAP_W, height: MINIMAP_H }}
    >
      {/* Label */}
      <div className="bg-gray-900/90 border-2 border-b-0 border-gray-600 px-2 py-0.5 font-mono text-[9px] text-gray-400 uppercase tracking-widest select-none">
        Minimap
      </div>
      <canvas
        ref={canvasRef}
        width={MINIMAP_W}
        height={MINIMAP_H}
        onClick={handleClick}
        className="block border-2 border-gray-600 cursor-crosshair shadow-[3px_3px_0px_0px_rgba(0,0,0,0.6)]"
        style={{ imageRendering: "pixelated" }}
        title="Click to navigate"
      />
    </div>
  );
}

"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import { Application, Container, Graphics, Text, Texture, TextureSource } from "pixi.js";
import { Viewport } from "pixi-viewport";
import { useAppStore } from "@/stores/app-store";
import { createDepartmentRoom } from "./DepartmentRoom";
import { createAgentAvatar, loadSpriteSheet, getCharTextures, resetSpriteSheet } from "./AgentAvatar";
import { PlayerCharacter, type PlayerKeys, type RoomCollider } from "./PlayerCharacter";
import { generateTileset, createTiledGround } from "./TilesetGenerator";
import { createEnvironmentAnimations, type AnimatedDecoration } from "./EnvironmentAnimations";
import { getThemePalette } from "./MapThemes";
import Minimap from "./Minimap";
import DialogueOverlay from "./DialogueOverlay";
import AgentStatCard from "./AgentStatCard";
import EventFeed from "./EventFeed";
import HudPanel from "./HudPanel";
import type { Agent } from "@/types";
import { getVendorColor } from "@/lib/utils";
import { getSupabaseBrowser } from "@/db/supabase-browser";

// ─── Sub-agent visualization helpers ─────────────────────────────────────────

interface SubAgentEntry {
  agent: Agent;
  container: Container;
  /** Connecting line Graphics from parent to this sub-agent */
  line: Graphics;
  /** 0→1 fade-in progress (spawn animation) */
  fadeIn: number;
  /** true when despawning (fade-out) */
  despawning: boolean;
  /** 0→1 fade-out progress (despawn animation) */
  fadeOut: number;
}

const SUBAGENT_SCALE = 0.8;
const SUBAGENT_ALPHA = 0.7;
const SUBAGENT_FADE_SPEED = 2.5; // alpha units per second (0→1 in 0.4s)
const SUBAGENT_LINE_ALPHA = 0.3;
const SUBAGENT_ORBIT_RADIUS = 48;

/** Create a small sub-agent sprite container (uses same avatar but scaled down) */
function createSubAgentSprite(agent: Agent, parentX: number, parentY: number, index: number, total: number): Container {
  const container = createAgentAvatar(agent);
  container.scale.set(SUBAGENT_SCALE);
  container.alpha = 0; // start invisible for fade-in

  // Place sub-agents in a semicircle below the parent
  const spread = Math.max(total - 1, 1);
  const angleStep = Math.PI / (spread + 1);
  const angle = Math.PI / 2 + angleStep * (index + 1) - Math.PI;
  container.x = parentX + Math.cos(angle) * SUBAGENT_ORBIT_RADIUS;
  container.y = parentY + Math.sin(angle) * SUBAGENT_ORBIT_RADIUS + SUBAGENT_ORBIT_RADIUS;

  return container;
}

/** Draw/update the connecting line from parent to sub-agent */
function updateSubAgentLine(
  line: Graphics,
  parentX: number,
  parentY: number,
  subX: number,
  subY: number,
  vendorColor: number,
  alpha: number,
): void {
  line.clear();
  line.moveTo(parentX, parentY);
  line.lineTo(subX, subY);
  line.stroke({ color: vendorColor, width: 1.5, alpha: SUBAGENT_LINE_ALPHA * alpha });
}

/** Draw or redraw a sub-agent count badge on a parent avatar container */
function drawSubAgentBadge(badgeGraphics: Graphics, count: number): void {
  badgeGraphics.clear();
  if (count <= 0) return;

  // Draw circle badge at top-left of avatar
  const bx = -18;
  const by = -20;
  const r = 8;
  badgeGraphics.circle(bx, by, r);
  badgeGraphics.fill({ color: 0x6366f1, alpha: 1 });
  badgeGraphics.circle(bx, by, r);
  badgeGraphics.stroke({ color: 0xffffff, width: 1.5 });
}

/** Create a Text label for sub-agent badge count (positioned on the badge) */
function createSubAgentBadgeText(count: number): Text {
  const label = new Text({
    text: `+${count}`,
    style: {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: 5,
      fontWeight: "700",
      fill: "#FFFFFF",
    },
  });
  label.anchor.set(0.5, 0.5);
  label.x = -18;
  label.y = -20;
  return label;
}

// Shared viewport ref for programmatic access
let sharedViewport: Viewport | null = null;
export function getViewport(): Viewport | null {
  return sharedViewport;
}

// Minimum world dimensions (expanded dynamically based on departments)
const MIN_WORLD_WIDTH = 1200;
const MIN_WORLD_HEIGHT = 600;
const WORLD_PADDING = 150;
const TILE_SIZE = 32;

// Decoration colors are now derived from theme palette (see createDecorationOverlay)

/** Simple seeded pseudo-random for deterministic placement */
function seededRand(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Draw a pixel-art tree at position */
function drawTree(g: Graphics, x: number, y: number, p: { treeTrunk: number; treeLeaves: number; treeLeavesLight: number }) {
  g.rect(x + 8, y + 16, 4, 8);
  g.fill(p.treeTrunk);
  g.rect(x + 4, y + 12, 12, 4);
  g.fill(p.treeLeaves);
  g.rect(x + 2, y + 8, 16, 4);
  g.fill(p.treeLeaves);
  g.rect(x + 4, y + 4, 12, 4);
  g.fill(p.treeLeaves);
  g.rect(x + 6, y, 8, 4);
  g.fill(p.treeLeavesLight);
  g.rect(x + 6, y + 8, 4, 4);
  g.fill(p.treeLeavesLight);
}

/** Draw a pixel-art bush at position */
function drawBush(g: Graphics, x: number, y: number, p: { bushColor: number; bushHighlight: number }) {
  g.rect(x, y + 4, 14, 8);
  g.fill(p.bushColor);
  g.rect(x + 2, y, 10, 4);
  g.fill(p.bushColor);
  g.rect(x + 4, y + 2, 4, 4);
  g.fill(p.bushHighlight);
}

/** Draw a tiny flower at position */
function drawFlower(g: Graphics, x: number, y: number, color: number, p: { grassBlade: number; flowerCenter: number }) {
  g.rect(x + 1, y + 3, 2, 4);
  g.fill(p.grassBlade);
  g.rect(x, y + 1, 4, 2);
  g.fill(color);
  g.rect(x + 1, y, 2, 4);
  g.fill(color);
  g.rect(x + 1, y + 1, 2, 2);
  g.fill(p.flowerCenter);
}

/** Draw a small stone at position */
function drawStone(g: Graphics, x: number, y: number, p: { stoneColor: number; stoneShadow: number; stoneHighlight: number }) {
  g.rect(x, y + 1, 6, 3);
  g.fill(p.stoneColor);
  g.rect(x + 1, y, 4, 1);
  g.fill(p.stoneColor);
  g.rect(x + 1, y + 4, 4, 1);
  g.fill(p.stoneShadow);
  g.rect(x + 1, y + 1, 2, 1);
  g.fill(p.stoneHighlight);
}

// ─── Urban decoration draw functions ─────────────────────────────────────────

/** Draw a pixel-art street lamp (~12x40px, roughly 1 tile tall) */
function drawStreetLamp(g: Graphics, x: number, y: number, p: { lampPost: number; lampLight: number }) {
  // Vertical pole
  g.rect(x + 5, y + 10, 3, 30);
  g.fill(p.lampPost);
  // Base plate
  g.rect(x + 2, y + 38, 8, 2);
  g.fill(p.lampPost);
  // Horizontal arm
  g.rect(x + 1, y + 8, 10, 3);
  g.fill(p.lampPost);
  // Lamp housing
  g.rect(x, y + 4, 12, 4);
  g.fill(0x444444);
  // Light bulb
  g.rect(x + 2, y + 6, 8, 3);
  g.fill(p.lampLight);
  // Glow halo
  g.rect(x - 4, y + 2, 20, 2);
  g.fill({ color: p.lampLight, alpha: 0.25 });
  g.rect(x - 2, y, 16, 2);
  g.fill({ color: p.lampLight, alpha: 0.15 });
}

/** Draw a pixel-art park bench (~28x16px, isometric top-down view) */
function drawBenchSeat(g: Graphics, x: number, y: number, p: { benchColor: number; benchLeg: number }) {
  // Back rest
  g.rect(x + 2, y, 24, 3);
  g.fill(p.benchColor);
  g.rect(x + 4, y + 1, 20, 2);
  g.fill({ color: 0xffffff, alpha: 0.1 }); // highlight
  // Seat planks (3 horizontal boards)
  g.rect(x + 1, y + 4, 26, 3);
  g.fill(p.benchColor);
  g.rect(x + 1, y + 8, 26, 3);
  g.fill(p.benchColor);
  // Plank gap lines
  g.rect(x + 1, y + 7, 26, 1);
  g.fill({ color: 0x000000, alpha: 0.15 });
  // Metal legs (4 legs visible from top)
  g.rect(x, y + 3, 2, 10);
  g.fill(p.benchLeg);
  g.rect(x + 8, y + 3, 2, 10);
  g.fill(p.benchLeg);
  g.rect(x + 18, y + 3, 2, 10);
  g.fill(p.benchLeg);
  g.rect(x + 26, y + 3, 2, 10);
  g.fill(p.benchLeg);
  // Leg shadow
  g.rect(x, y + 12, 28, 2);
  g.fill({ color: 0x000000, alpha: 0.1 });
}

/** Draw a pixel-art vending machine (~20x32px, about 1 tile) */
function drawVendingMachine(g: Graphics, x: number, y: number, p: { vendingBody: number; vendingScreen: number }) {
  // Shadow
  g.rect(x + 2, y + 30, 18, 2);
  g.fill({ color: 0x000000, alpha: 0.15 });
  // Body
  g.rect(x, y, 20, 32);
  g.fill(p.vendingBody);
  // Top edge highlight
  g.rect(x, y, 20, 2);
  g.fill({ color: 0xffffff, alpha: 0.15 });
  // Screen / product display window
  g.rect(x + 3, y + 3, 14, 12);
  g.fill(p.vendingScreen);
  // Product rows in screen (3 rows of colored dots)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const colors = [0xcc3333, 0x33aa33, 0x3366cc, 0xccaa33];
      g.rect(x + 4 + col * 3, y + 4 + row * 4, 2, 3);
      g.fill(colors[(row + col) % 4]);
    }
  }
  // Button panel
  g.rect(x + 3, y + 17, 14, 4);
  g.fill(0x333344);
  // Buttons
  g.rect(x + 4, y + 18, 3, 2);
  g.fill(0xcc3333);
  g.rect(x + 8, y + 18, 3, 2);
  g.fill(0x33cc33);
  g.rect(x + 12, y + 18, 3, 2);
  g.fill(0x3333cc);
  // Dispenser slot
  g.rect(x + 5, y + 23, 10, 6);
  g.fill(0x1a1a1a);
  g.rect(x + 6, y + 24, 8, 4);
  g.fill(0x111111);
}

/** Draw a pixel-art fire hydrant (~12x18px) */
function drawFireHydrant(g: Graphics, x: number, y: number, p: { hydrantColor: number }) {
  // Shadow
  g.rect(x + 1, y + 16, 10, 2);
  g.fill({ color: 0x000000, alpha: 0.12 });
  // Base
  g.rect(x + 1, y + 14, 10, 3);
  g.fill(p.hydrantColor);
  // Main body
  g.rect(x + 2, y + 4, 8, 10);
  g.fill(p.hydrantColor);
  // Body highlight
  g.rect(x + 3, y + 5, 2, 8);
  g.fill({ color: 0xffffff, alpha: 0.15 });
  // Top cap
  g.rect(x + 3, y + 1, 6, 3);
  g.fill(p.hydrantColor);
  // Top knob
  g.rect(x + 5, y, 2, 2);
  g.fill(p.hydrantColor);
  // Side valves
  g.rect(x, y + 7, 3, 3);
  g.fill(p.hydrantColor);
  g.rect(x + 9, y + 7, 3, 3);
  g.fill(p.hydrantColor);
  // Chain ring detail
  g.rect(x + 4, y + 12, 4, 1);
  g.fill({ color: 0x888888, alpha: 0.6 });
}

/** Draw a pixel-art manhole cover (~16x10px, oval top-down view) */
function drawManhole(g: Graphics, x: number, y: number, p: { manholeColor: number }) {
  // Outer rim
  g.rect(x + 1, y, 14, 10);
  g.fill(p.manholeColor);
  g.rect(x, y + 2, 16, 6);
  g.fill(p.manholeColor);
  // Inner circle (slightly darker)
  g.rect(x + 2, y + 1, 12, 8);
  g.fill({ color: 0x000000, alpha: 0.12 });
  g.rect(x + 3, y + 2, 10, 6);
  g.fill(p.manholeColor);
  // Cross grid pattern
  g.rect(x + 7, y + 2, 2, 6);
  g.fill({ color: 0x333333, alpha: 0.4 });
  g.rect(x + 3, y + 4, 10, 2);
  g.fill({ color: 0x333333, alpha: 0.4 });
  // Grip holes
  g.rect(x + 5, y + 3, 2, 1);
  g.fill({ color: 0x222222, alpha: 0.5 });
  g.rect(x + 9, y + 3, 2, 1);
  g.fill({ color: 0x222222, alpha: 0.5 });
  g.rect(x + 5, y + 6, 2, 1);
  g.fill({ color: 0x222222, alpha: 0.5 });
  g.rect(x + 9, y + 6, 2, 1);
  g.fill({ color: 0x222222, alpha: 0.5 });
}

/** Draw a pixel-art potted plant (~16x24px) */
function drawPottedPlant(g: Graphics, x: number, y: number, p: { pottedPlant: number; pottedPot: number }) {
  // Plant canopy (bushy top)
  g.rect(x + 4, y, 8, 3);
  g.fill(p.pottedPlant);
  g.rect(x + 2, y + 3, 12, 3);
  g.fill(p.pottedPlant);
  g.rect(x + 1, y + 6, 14, 4);
  g.fill(p.pottedPlant);
  // Leaf highlights
  g.rect(x + 5, y + 1, 3, 2);
  g.fill({ color: 0xffffff, alpha: 0.12 });
  g.rect(x + 3, y + 4, 4, 2);
  g.fill({ color: 0xffffff, alpha: 0.1 });
  // Stem
  g.rect(x + 7, y + 10, 2, 3);
  g.fill(0x3a6a3a);
  // Pot rim
  g.rect(x + 3, y + 13, 10, 2);
  g.fill(p.pottedPot);
  // Pot body (tapered)
  g.rect(x + 4, y + 15, 8, 4);
  g.fill(p.pottedPot);
  g.rect(x + 5, y + 19, 6, 3);
  g.fill(p.pottedPot);
  // Pot base
  g.rect(x + 4, y + 22, 8, 2);
  g.fill(p.pottedPot);
  // Pot shadow
  g.rect(x + 5, y + 24, 8, 1);
  g.fill({ color: 0x000000, alpha: 0.1 });
  // Pot shading
  g.rect(x + 4, y + 16, 2, 3);
  g.fill({ color: 0xffffff, alpha: 0.1 });
}

/** Check if a point overlaps with any department room (with padding) */
function overlapsRoom(
  px: number, py: number, size: number,
  rooms: { x: number; y: number; w: number; h: number }[],
  pad: number,
): boolean {
  for (const r of rooms) {
    if (
      px + size > r.x - pad && px < r.x + r.w + pad &&
      py + size > r.y - pad && py < r.y + r.h + pad
    ) return true;
  }
  return false;
}

/** Create decoration overlay (trees, bushes, flowers, stones) on top of tiled ground */
function createDecorationOverlay(
  worldW: number, worldH: number,
  rooms: { x: number; y: number; w: number; h: number }[],
  palette: import("./MapThemes").MapThemePalette,
): Container {
  const decorations = new Graphics();
  const pad = TILE_SIZE * 4;
  const DECOR_STEP = 80;

  if (palette.decorationStyle === "urban") {
    // ── Structured urban placement relative to rooms ──
    const LAMP_INTERVAL = 160; // lamp posts every ~5 tiles — sparse

    for (const room of rooms) {
      const doorX = room.x + Math.floor(room.w / 2);
      const doorY = room.y + room.h;

      // Potted plants flanking the entrance
      drawPottedPlant(decorations, doorX - 24, doorY + 6, palette);
      drawPottedPlant(decorations, doorX + 16, doorY + 6, palette);

      // Bench near entrance (left of the door, facing the street)
      const benchX = doorX - 56;
      if (!overlapsRoom(benchX, doorY + 10, 28, rooms, 4)) {
        drawBenchSeat(decorations, benchX, doorY + 10, palette);
      }

      // Vending machine against the right outer wall
      const vmX = room.x + room.w + 10;
      const vmY = room.y + Math.floor(room.h / 2) - 16;
      if (!overlapsRoom(vmX, vmY, 20, rooms, 6)) {
        drawVendingMachine(decorations, vmX, vmY, palette);
      }

      // Fire hydrant at the left-front corner of the building
      const fhX = room.x - 18;
      const fhY = doorY + 4;
      if (!overlapsRoom(fhX, fhY, 12, rooms, 6)) {
        drawFireHydrant(decorations, fhX, fhY, palette);
      }

      // (Animated street lamp glow is placed by EnvironmentAnimations — no static lamp near door)

      // Manhole in the road area in front of the room
      const mhX = doorX + 36;
      const mhY = doorY + 40;
      if (!overlapsRoom(mhX, mhY, 16, rooms, 8)) {
        drawManhole(decorations, mhX, mhY, palette);
      }
    }

    // Sparse street lamps along the world perimeter (every ~5 tiles)
    for (let lx = 48; lx < worldW - 48; lx += LAMP_INTERVAL) {
      if (!overlapsRoom(lx, 16, 12, rooms, 32)) {
        drawStreetLamp(decorations, lx, 16, palette);
      }
    }

    // Sparse benches in open corridor areas (very few)
    for (let dx = 80; dx < worldW - 80; dx += LAMP_INTERVAL * 2) {
      for (let dy = 80; dy < worldH - 80; dy += LAMP_INTERVAL * 2) {
        const r = seededRand(dx * 7, dy * 13);
        if (r < 0.2 && !overlapsRoom(dx, dy, 28, rooms, 40)) {
          drawBenchSeat(decorations, dx, dy, palette);
        }
      }
    }
  } else {
    // ── Nature decorations (random scatter) ──
    for (let dx = -pad; dx < worldW + pad; dx += DECOR_STEP) {
      for (let dy = -pad; dy < worldH + pad; dy += DECOR_STEP) {
        const r = seededRand(dx * 7, dy * 13);
        if (r < 0.15 && !overlapsRoom(dx, dy, 24, rooms, 20)) {
          drawTree(decorations, dx + seededRand(dx, dy * 3) * 20, dy + seededRand(dy, dx * 5) * 20, palette);
        } else if (r < 0.22 && !overlapsRoom(dx, dy, 14, rooms, 16)) {
          drawBush(decorations, dx + seededRand(dx * 2, dy) * 16, dy + seededRand(dy * 2, dx) * 16, palette);
        } else if (r < 0.30 && !overlapsRoom(dx, dy, 6, rooms, 10)) {
          drawFlower(
            decorations,
            dx + seededRand(dx * 3, dy) * 20,
            dy + seededRand(dy * 3, dx) * 20,
            palette.flowerColors[Math.floor(seededRand(dx, dy * 7) * palette.flowerColors.length)],
            palette,
          );
        } else if (r < 0.34 && !overlapsRoom(dx, dy, 8, rooms, 12)) {
          drawStone(decorations, dx + seededRand(dx * 5, dy) * 16, dy + seededRand(dy * 5, dx) * 16, palette);
        }
      }
    }
  }

  return decorations;
}

function hexToNum(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

/** Find a spawn point outside all rooms (near the first room's door) */
function findSpawnPoint(rooms: RoomCollider[]): { x: number; y: number } {
  if (rooms.length === 0) return { x: 200, y: 200 };
  // Spawn just outside the first room's door
  const first = rooms[0];
  return {
    x: first.doorX,
    y: first.y + first.h + 30,
  };
}

// Drag state tracked outside React to avoid re-renders during pointer moves
interface DragState {
  active: boolean;
  avatar: Container | null;
  agent: Agent | null;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  moved: boolean;
}

const DRAG_THRESHOLD = 5; // px — movement below this counts as a click

export default function SpatialCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const viewportRef = useRef<Viewport | null>(null);
  const playerRef = useRef<PlayerCharacter | null>(null);
  const keysRef = useRef<PlayerKeys>({ up: false, down: false, left: false, right: false, interact: false });
  const dragRef = useRef<DragState>({ active: false, avatar: null, agent: null, startX: 0, startY: 0, offsetX: 0, offsetY: 0, moved: false });
  const [nearbyAgentName, setNearbyAgentName] = useState<string | null>(null);
  const [dialogueAgent, setDialogueAgent] = useState<Agent | null>(null);
  const [worldDims, setWorldDims] = useState({ width: MIN_WORLD_WIDTH, height: MIN_WORLD_HEIGHT });
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);
  const dialogueOpenRef = useRef(false);
  const organization = useAppStore((s) => s.organization);
  const [playerName, setPlayerName] = useState("Guest");

  // Fetch logged-in user's display name
  useEffect(() => {
    getSupabaseBrowser().auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name = user.user_metadata?.full_name ?? user.email ?? "Guest";
        setPlayerName(name);
      }
    });
  }, []);

  // Recent agents persisted in localStorage (max 3, most recent first)
  const recentKey = `agent-factorio-recent-agents-${organization.id}`;
  const [recentAgentIds, setRecentAgentIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(`agent-factorio-recent-agents-`);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  // Re-sync from localStorage when org changes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(recentKey);
      if (stored) setRecentAgentIds(JSON.parse(stored));
      else setRecentAgentIds([]);
    } catch { setRecentAgentIds([]); }
  }, [recentKey]);

  const trackRecentAgent = useCallback((agentId: string) => {
    setRecentAgentIds((prev) => {
      const next = [agentId, ...prev.filter((id) => id !== agentId)].slice(0, 3);
      try { localStorage.setItem(recentKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [recentKey]);
  const mapTheme = useAppStore((s) => s.mapTheme);
  const getSelectedAgent = useAppStore((s) => s.getSelectedAgent);
  const selectedAgent = getSelectedAgent();

  // Keyboard event handlers
  useEffect(() => {
    const keys = keysRef.current;

    const onKeyDown = (e: KeyboardEvent) => {
      // Don't capture keys when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case "ArrowUp": case "w": case "W":
          keys.up = true; e.preventDefault(); break;
        case "ArrowDown": case "s": case "S":
          keys.down = true; e.preventDefault(); break;
        case "ArrowLeft": case "a": case "A":
          keys.left = true; e.preventDefault(); break;
        case "ArrowRight": case "d": case "D":
          keys.right = true; e.preventDefault(); break;
        case "e": case "E":
          keys.interact = true; e.preventDefault(); break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowUp": case "w": case "W":
          keys.up = false; break;
        case "ArrowDown": case "s": case "S":
          keys.down = false; break;
        case "ArrowLeft": case "a": case "A":
          keys.left = false; break;
        case "ArrowRight": case "d": case "D":
          keys.right = false; break;
        case "e": case "E":
          keys.interact = false; break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    const div = containerRef.current;
    if (!div) return;

    let destroyed = false;
    const app = new Application();
    appRef.current = app;

    const palette = getThemePalette(mapTheme);

    (async () => {
      // Set pixel-perfect (nearest-neighbor) scaling for all textures
      TextureSource.defaultOptions.scaleMode = "nearest";

      await app.init({
        background: palette.background,
        width: div.clientWidth,
        height: div.clientHeight,
        antialias: false,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      });

      if (destroyed) {
        app.destroy(true);
        return;
      }

      div.appendChild(app.canvas as HTMLCanvasElement);

      // Preload retro font before creating any text textures
      try {
        await document.fonts.load('8px "Press Start 2P"');
      } catch {
        // Font may not be available yet, continue anyway
      }

      // Create viewport
      const viewport = new Viewport({
        screenWidth: div.clientWidth,
        screenHeight: div.clientHeight,
        worldWidth: MIN_WORLD_WIDTH,
        worldHeight: MIN_WORLD_HEIGHT,
        events: app.renderer.events,
      });

      // Player mode: wheel zoom + pinch only (no drag — player moves via keyboard)
      viewport
        .pinch()
        .wheel()
        .clampZoom({ minScale: 0.5, maxScale: 3 });

      app.stage.addChild(viewport as unknown as Container);
      viewportRef.current = viewport;
      sharedViewport = viewport;

      // Enable sortable children for z-ordering (player on top)
      viewport.sortableChildren = true;

      // Calculate dynamic world dimensions from department data
      const rooms = organization.departments.map((d) => ({
        x: d.layout.x,
        y: d.layout.y,
        w: d.layout.width,
        h: d.layout.height,
      }));

      let worldWidth = MIN_WORLD_WIDTH;
      let worldHeight = MIN_WORLD_HEIGHT;
      for (const r of rooms) {
        worldWidth = Math.max(worldWidth, r.x + r.w + WORLD_PADDING);
        worldHeight = Math.max(worldHeight, r.y + r.h + WORLD_PADDING);
      }

      viewport.worldWidth = worldWidth;
      viewport.worldHeight = worldHeight;
      setWorldDims({ width: worldWidth, height: worldHeight });

      // Generate tileset and tiled ground layer
      const tileset = generateTileset(app.renderer, palette);
      const { ground: groundLayer, ponds } = createTiledGround(
        app.renderer, worldWidth, worldHeight, rooms, tileset, palette,
      );
      viewport.addChild(groundLayer);

      // Add decoration overlay (trees, bushes, flowers, stones) on top of tiled ground
      const decorOverlay = createDecorationOverlay(worldWidth, worldHeight, rooms, palette);
      decorOverlay.zIndex = 2;
      viewport.addChild(decorOverlay);

      // Load sprite sheet before creating avatars
      await loadSpriteSheet();

      if (destroyed) { app.destroy(true); return; }

      // Build room colliders for player collision
      const roomColliders: RoomCollider[] = organization.departments.map((dept) => {
        const { x, y, width, height } = dept.layout;
        const doorW = 18;
        return {
          x,
          y,
          w: width,
          h: height,
          doorX: x + Math.floor(width / 2),
          doorY: y + height,
          doorW,
        };
      });

      // Render departments and agents
      const avatarContainers: (Container & { _baseY: number; _agentStatus: string })[] = [];
      const agentPositionMap: { agent: Agent; x: number; y: number; container: Container }[] = [];

      // Build room data with vendor colors for environment animations
      const roomsWithVendor = organization.departments.map((dept) => ({
        x: dept.layout.x,
        y: dept.layout.y,
        w: dept.layout.width,
        h: dept.layout.height,
        vendorColor: hexToNum(getVendorColor(dept.primaryVendor)),
      }));

      for (const dept of organization.departments) {
        const roomContainer = createDepartmentRoom(dept, (d) => {
          // Double-click: zoom to room
          const { x, y, width, height } = d.layout;
          viewport.animate({
            position: { x: x + width / 2, y: y + height / 2 },
            scale: 1.8,
            time: 400,
            ease: "easeInOutSine",
          });
        });
        viewport.addChild(roomContainer);

        const { x: dx, y: dy, width: dw, height: dh } = dept.layout;
        const PAD = 30;
        const AGENT_GAP = 50;
        const availW = dw - PAD * 2;
        const cols = Math.max(1, Math.floor(availW / AGENT_GAP));

        for (let ai = 0; ai < dept.agents.length; ai++) {
          const agent = dept.agents[ai];
          const px = agent.position.x;
          const py = agent.position.y;
          const inside =
            px >= dx + PAD && px <= dx + dw - PAD &&
            py >= dy + PAD && py <= dy + dh - PAD;

          if (!inside) {
            agent.position.x = dx + PAD + (ai % cols) * AGENT_GAP + AGENT_GAP / 2;
            agent.position.y = dy + PAD + 20 + Math.floor(ai / cols) * AGENT_GAP + AGENT_GAP / 2;
          }

          const siblingIds = dept.agents.map((a) => a.id);
          const avatar = createAgentAvatar(agent, siblingIds);
          avatar.zIndex = 10;
          viewport.addChild(avatar);
          avatarContainers.push(avatar as Container & { _baseY: number; _agentStatus: string });

          const posEntry = {
            agent,
            x: agent.position.x,
            y: agent.position.y,
            container: avatar,
          };
          agentPositionMap.push(posEntry);

          // === Drag-and-drop handlers ===
          avatar.eventMode = "static";
          avatar.cursor = "grab";

          avatar.on("pointerdown", (e) => {
            e.stopPropagation();
            const worldPos = viewport.toWorld(e.global.x, e.global.y);
            dragRef.current = {
              active: true,
              avatar,
              agent,
              startX: worldPos.x,
              startY: worldPos.y,
              offsetX: avatar.x - worldPos.x,
              offsetY: avatar.y - worldPos.y,
              moved: false,
            };
            avatar.cursor = "grabbing";
            avatar.zIndex = 100;
            avatar.scale.set(1.15);
          });

          // Hover → show stat card
          avatar.on("pointerover", () => {
            setHoveredAgentId(agent.id);
          });
          avatar.on("pointerout", () => {
            setHoveredAgentId(null);
          });
        }
      }

      // === Sub-agent visualization ===
      // Build mock sub-agent data: attach sub-agents to the first two active agents found
      const allAgents = organization.departments.flatMap((d) => d.agents);
      const parentCandidates = allAgents.filter((a) => a.status === "active" && !a.is_subagent).slice(0, 2);

      // Mock sub-agents seeded from parent agent data
      const mockSubAgentsByParent = new Map<string, Agent[]>();
      for (let pi = 0; pi < parentCandidates.length; pi++) {
        const parent = parentCandidates[pi];
        const count = pi === 0 ? 2 : 1; // first parent gets 2, second gets 1
        const subs: Agent[] = Array.from({ length: count }, (_, si) => ({
          ...parent,
          id: `${parent.id}__sub_${si}`,
          name: `sub-${si + 1}`,
          status: "active" as const,
          is_subagent: true,
          parent_agent_id: parent.id,
          sub_agents: [],
          position: { x: parent.position.x, y: parent.position.y },
        }));
        mockSubAgentsByParent.set(parent.id, subs);
      }

      // Track sub-agent entries for animation
      const subAgentEntries: SubAgentEntry[] = [];

      // Badge graphics map: parentAvatarContainer → { bg: Graphics; label: Text }
      const badgeMap = new Map<Container, { bg: Graphics; label: Text }>();

      for (const posEntry of agentPositionMap) {
        const agent = posEntry.agent;
        const subs = mockSubAgentsByParent.get(agent.id);
        if (!subs || subs.length === 0) continue;

        const parentContainer = posEntry.container;
        const parentX = posEntry.x;
        const parentY = posEntry.y;
        const vendorColor = hexToNum(getVendorColor(agent.vendor));

        // Add badge to parent avatar
        const badgeBg = new Graphics();
        drawSubAgentBadge(badgeBg, subs.length);
        parentContainer.addChild(badgeBg);

        const badgeLabel = createSubAgentBadgeText(subs.length);
        parentContainer.addChild(badgeLabel);
        badgeMap.set(parentContainer, { bg: badgeBg, label: badgeLabel });

        // Create sub-agent sprites and connecting lines
        for (let si = 0; si < subs.length; si++) {
          const sub = subs[si];
          const subContainer = createSubAgentSprite(sub, parentX, parentY, si, subs.length);
          subContainer.zIndex = 9; // just below regular agents
          viewport.addChild(subContainer);

          const line = new Graphics();
          line.zIndex = 8; // below sub-agents
          viewport.addChild(line);

          // Draw initial line (invisible while fading in)
          updateSubAgentLine(line, parentX, parentY, subContainer.x, subContainer.y, vendorColor, 0);

          subAgentEntries.push({
            agent: sub,
            container: subContainer,
            line,
            fadeIn: 0,
            despawning: false,
            fadeOut: 0,
          });
        }
      }

      // === Create animated environment objects ===
      const animatedObjects: AnimatedDecoration[] = createEnvironmentAnimations(roomsWithVendor, ponds, palette);
      for (const anim of animatedObjects) {
        anim.container.zIndex = 5; // above ground, below agents
        viewport.addChild(anim.container);
      }

      // === Global drag move/up handlers ===
      viewport.on("globalpointermove", (e) => {
        const drag = dragRef.current;
        if (!drag.active || !drag.avatar) return;
        const worldPos = viewport.toWorld(e.global.x, e.global.y);
        const dx = worldPos.x - drag.startX;
        const dy = worldPos.y - drag.startY;
        if (!drag.moved && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
          drag.moved = true;
        }
        if (drag.moved) {
          drag.avatar.x = worldPos.x + drag.offsetX;
          drag.avatar.y = worldPos.y + drag.offsetY;
          // Update agentPositionMap entry so proximity detection uses new position
          const entry = agentPositionMap.find((e) => e.agent.id === drag.agent!.id);
          if (entry) {
            entry.x = drag.avatar.x;
            entry.y = drag.avatar.y;
          }
        }
      });

      viewport.on("pointerup", () => {
        const drag = dragRef.current;
        if (!drag.active || !drag.avatar) return;
        const avatar = drag.avatar as Container & { _baseY: number };
        const agent = drag.agent!;
        // Restore visual state
        avatar.cursor = "grab";
        avatar.zIndex = 10;
        avatar.scale.set(1);
        if (drag.moved) {
          // Update _baseY so bobbing animation uses new position
          avatar._baseY = avatar.y;
          // Update agent position in data model
          agent.position.x = avatar.x;
          agent.position.y = avatar.y;
          // Persist to DB (fire-and-forget)
          const orgId = organization.id;
          fetch(`/api/organizations/${orgId}/agents/${agent.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ posX: avatar.x, posY: avatar.y }),
          });
        } else {
          // Short click — select agent (existing behavior)
          useAppStore.getState().selectAgent(agent.id);
          trackRecentAgent(agent.id);
        }
        dragRef.current = { active: false, avatar: null, agent: null, startX: 0, startY: 0, offsetX: 0, offsetY: 0, moved: false };
      });

      viewport.on("pointerupoutside", () => {
        const drag = dragRef.current;
        if (!drag.active || !drag.avatar) return;
        // Restore visual state even if pointer left canvas
        drag.avatar.cursor = "grab";
        drag.avatar.zIndex = 10;
        drag.avatar.scale.set(1);
        if (drag.moved) {
          const agent = drag.agent!;
          agent.position.x = drag.avatar.x;
          agent.position.y = drag.avatar.y;
          const orgId = organization.id;
          fetch(`/api/organizations/${orgId}/agents/${agent.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ posX: drag.avatar.x, posY: drag.avatar.y }),
          });
        }
        dragRef.current = { active: false, avatar: null, agent: null, startX: 0, startY: 0, offsetX: 0, offsetY: 0, moved: false };
      });

      // === Create Player Character ===
      const playerCharTextures = getCharTextures();
      const playerTexture = playerCharTextures[0] ?? Texture.EMPTY; // char_0 for the player
      const spawn = findSpawnPoint(roomColliders);
      const player = new PlayerCharacter(spawn.x, spawn.y, playerTexture, 0, playerName);
      playerRef.current = player;
      viewport.addChild(player.container);

      // Camera: follow the player
      viewport.follow(player.container, {
        speed: 0, // instant follow (no lag)
        acceleration: null,
        radius: null,
      });
      viewport.setZoom(1.8, true);

      // === Game loop ===
      let elapsed = 0;
      app.ticker.add((ticker) => {
        const dt = ticker.deltaTime / 60; // seconds
        elapsed += dt;

        // Block movement keys while dialogue is open
        const keys = keysRef.current;
        if (dialogueOpenRef.current) {
          keys.up = false;
          keys.down = false;
          keys.left = false;
          keys.right = false;
          keys.interact = false;
        }

        // Update player
        const { nearby, interacted } = player.update(keys, dt, roomColliders, agentPositionMap);

        // Handle interaction — open dialogue
        if (interacted && !dialogueOpenRef.current) {
          dialogueOpenRef.current = true;
          setDialogueAgent(interacted.agent);
          trackRecentAgent(interacted.agent.id);
        }

        // Update React state for UI overlay (throttled)
        const newName = nearby ? nearby.agent.name : null;
        setNearbyAgentName((prev) => prev === newName ? prev : newName);

        // Agent idle/error animations (skip for currently-dragged avatar)
        const draggedAvatar = dragRef.current.active ? dragRef.current.avatar : null;
        for (const avatar of avatarContainers) {
          if (avatar === draggedAvatar) continue;
          if (avatar._agentStatus === "active") {
            avatar.y = avatar._baseY + Math.sin(elapsed * 2.5 + avatar._baseY) * 3;
          } else if (avatar._agentStatus === "error") {
            const pulse = 0.85 + Math.sin(elapsed * 5) * 0.15;
            avatar.scale.set(pulse);
          }
        }

        // Update sub-agent fade animations and connecting lines
        for (const entry of subAgentEntries) {
          const { container, line, agent: subAgent } = entry;

          // Find parent position from agentPositionMap
          const parentId = subAgent.parent_agent_id;
          const parentEntry = parentId ? agentPositionMap.find((e) => e.agent.id === parentId) : null;
          const parentX = parentEntry ? parentEntry.container.x : container.x;
          const parentY = parentEntry ? parentEntry.container.y : container.y;

          if (!entry.despawning) {
            // Fade in
            entry.fadeIn = Math.min(1, entry.fadeIn + dt * SUBAGENT_FADE_SPEED);
            const alpha = entry.fadeIn * SUBAGENT_ALPHA;
            container.alpha = alpha;
            // Gentle bob animation (offset from parent bobbing)
            const bobOffset = Math.sin(elapsed * 2.5 + container.x * 0.1) * 2;
            container.y = (parentEntry ? parentEntry.container.y : container.y) + SUBAGENT_ORBIT_RADIUS + bobOffset;
            updateSubAgentLine(
              line,
              parentX,
              parentEntry ? parentEntry.container.y : parentY,
              container.x,
              container.y,
              hexToNum(getVendorColor(subAgent.vendor)),
              entry.fadeIn,
            );
          } else {
            // Fade out
            entry.fadeOut = Math.min(1, entry.fadeOut + dt * SUBAGENT_FADE_SPEED);
            const alpha = SUBAGENT_ALPHA * (1 - entry.fadeOut);
            container.alpha = alpha;
            updateSubAgentLine(
              line,
              parentX,
              parentEntry ? parentEntry.container.y : parentY,
              container.x,
              container.y,
              hexToNum(getVendorColor(subAgent.vendor)),
              1 - entry.fadeOut,
            );
            if (entry.fadeOut >= 1) {
              container.visible = false;
              line.visible = false;
            }
          }
        }

        // Update animated environment objects
        for (const anim of animatedObjects) {
          anim.update(elapsed);
        }
      });

      // Handle resize
      const onResize = () => {
        if (destroyed) return;
        app.renderer.resize(div.clientWidth, div.clientHeight);
        viewport.resize(div.clientWidth, div.clientHeight);
      };
      window.addEventListener("resize", onResize);

      (app as Application & { _cleanup?: () => void })._cleanup = () => {
        window.removeEventListener("resize", onResize);
        // Clean up animated bubble intervals for active agent avatars
        for (const avatar of avatarContainers) {
          const av = avatar as Container & { _cleanup?: { destroy: () => void } };
          if (av._cleanup) av._cleanup.destroy();
        }
      };
    })();

    return () => {
      destroyed = true;
      sharedViewport = null;
      resetSpriteSheet();
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      const currentApp = appRef.current;
      if (currentApp) {
        const cleanup = (currentApp as Application & { _cleanup?: () => void })._cleanup;
        if (cleanup) cleanup();
        try {
          const canvas = currentApp.canvas as HTMLCanvasElement | undefined;
          if (canvas && canvas.parentNode) {
            canvas.parentNode.removeChild(canvas);
          }
          currentApp.destroy(true, { children: true });
        } catch {
          // Pixi may throw if init hasn't completed yet
        }
      }
      appRef.current = null;
      viewportRef.current = null;
    };
  }, [organization, mapTheme, playerName]);

  const getViewportBounds = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return null;
    return {
      x: vp.left,
      y: vp.top,
      width: vp.worldScreenWidth,
      height: vp.worldScreenHeight,
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Game-style control hints overlay */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <div className="bg-gray-900/80 border-2 border-gray-600 px-3 py-2 font-mono text-xs text-gray-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-0.5">
              <kbd className="bg-gray-700 border border-gray-500 px-1.5 py-0.5 text-[10px] text-amber-200 rounded-sm">W</kbd>
              <div className="flex gap-0.5">
                <kbd className="bg-gray-700 border border-gray-500 px-1.5 py-0.5 text-[10px] text-amber-200 rounded-sm">A</kbd>
                <kbd className="bg-gray-700 border border-gray-500 px-1.5 py-0.5 text-[10px] text-amber-200 rounded-sm">S</kbd>
                <kbd className="bg-gray-700 border border-gray-500 px-1.5 py-0.5 text-[10px] text-amber-200 rounded-sm">D</kbd>
              </div>
            </div>
            <span className="text-gray-400">Move</span>
            <div className="h-4 w-px bg-gray-600" />
            <kbd className="bg-gray-700 border border-gray-500 px-1.5 py-0.5 text-[10px] text-amber-200 rounded-sm">E</kbd>
            <span className="text-gray-400">Talk</span>
          </div>
        </div>
      </div>

      {/* Nearby agent indicator — hidden when dialogue is open, offset above HUD */}
      {nearbyAgentName && !dialogueAgent && (
        <div className="absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none" style={{ bottom: 120 }}>
          <div className="bg-gray-900/90 border-2 border-blue-500/60 px-4 py-2 font-mono text-sm text-blue-200 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.6)] animate-pulse">
            Press <kbd className="bg-gray-700 border border-blue-400 px-1.5 py-0.5 text-xs text-blue-300 rounded-sm mx-1">E</kbd> to talk to <span className="text-white font-bold">{nearbyAgentName}</span>
          </div>
        </div>
      )}

      {/* RPG dialogue overlay */}
      {dialogueAgent && (
        <DialogueOverlay
          agent={dialogueAgent}
          orgId={organization.id}
          onClose={() => {
            setDialogueAgent(null);
            dialogueOpenRef.current = false;
          }}
        />
      )}

      <Minimap
        departments={organization.departments}
        worldWidth={worldDims.width}
        worldHeight={worldDims.height}
        getViewportBounds={getViewportBounds}
      />

      {/* RPG Agent Stat Card — bottom-left, above HUD */}
      <AgentStatCard hoveredAgentId={hoveredAgentId} />

      {/* StarCraft-style Event Feed — top-right overlay */}
      <EventFeed organization={organization} />

      {/* StarCraft-style HUD Command Panel — fixed bottom */}
      <HudPanel
        organization={organization}
        orgId={organization.id}
        recentAgentIds={recentAgentIds}
      />
    </div>
  );
}

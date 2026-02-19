"use client";

import React, { useRef, useEffect, useCallback } from "react";
import { Application, Container, Graphics, Sprite, Texture } from "pixi.js";
import { Viewport } from "pixi-viewport";
import { useAppStore } from "@/stores/app-store";
import { createDepartmentRoom } from "./DepartmentRoom";
import { createAgentAvatar, loadSpriteSheet, resetSpriteSheet } from "./AgentAvatar";
import MapControls from "./MapControls";

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

// Game-style ground color palette
const GRASS_COLORS = [0x4a7a3d, 0x528a45, 0x3d6b33];
const PATH_COLOR = 0xc4a882;
const PATH_EDGE = 0xb09870;
const TREE_TRUNK = 0x6b4226;
const TREE_LEAVES = 0x2d5a1e;
const TREE_LEAVES_LIGHT = 0x3d7a2e;
const BUSH_COLOR = 0x3a6e2a;
const BUSH_HIGHLIGHT = 0x4a8e3a;
const FLOWER_COLORS = [0xe85d75, 0xf0c040, 0xd0d0ff, 0xff9944];
const STONE_COLOR = 0x8a8a8a;
const STONE_SHADOW = 0x6a6a6a;

/** Simple seeded pseudo-random for deterministic placement */
function seededRand(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Draw a pixel-art tree at position */
function drawTree(g: Graphics, x: number, y: number) {
  // Trunk (4x8)
  g.rect(x + 8, y + 16, 4, 8);
  g.fill(TREE_TRUNK);
  // Canopy - triangle as stacked rects for pixel look
  g.rect(x + 4, y + 12, 12, 4);
  g.fill(TREE_LEAVES);
  g.rect(x + 2, y + 8, 16, 4);
  g.fill(TREE_LEAVES);
  g.rect(x + 4, y + 4, 12, 4);
  g.fill(TREE_LEAVES);
  g.rect(x + 6, y, 8, 4);
  g.fill(TREE_LEAVES_LIGHT);
  // Highlight
  g.rect(x + 6, y + 8, 4, 4);
  g.fill(TREE_LEAVES_LIGHT);
}

/** Draw a pixel-art bush at position */
function drawBush(g: Graphics, x: number, y: number) {
  g.rect(x, y + 4, 14, 8);
  g.fill(BUSH_COLOR);
  g.rect(x + 2, y, 10, 4);
  g.fill(BUSH_COLOR);
  // Highlight
  g.rect(x + 4, y + 2, 4, 4);
  g.fill(BUSH_HIGHLIGHT);
}

/** Draw a tiny flower at position */
function drawFlower(g: Graphics, x: number, y: number, color: number) {
  // Stem
  g.rect(x + 1, y + 3, 2, 4);
  g.fill(0x3d6b33);
  // Petals (cross pattern)
  g.rect(x, y + 1, 4, 2);
  g.fill(color);
  g.rect(x + 1, y, 2, 4);
  g.fill(color);
  // Center
  g.rect(x + 1, y + 1, 2, 2);
  g.fill(0xffee88);
}

/** Draw a small stone at position */
function drawStone(g: Graphics, x: number, y: number) {
  g.rect(x, y + 1, 6, 3);
  g.fill(STONE_COLOR);
  g.rect(x + 1, y, 4, 1);
  g.fill(STONE_COLOR);
  g.rect(x + 1, y + 4, 4, 1);
  g.fill(STONE_SHADOW);
  // Highlight
  g.rect(x + 1, y + 1, 2, 1);
  g.fill(0xa0a0a0);
}

/** Draw a 16px wide dirt path segment */
function drawPathH(g: Graphics, x: number, y: number, w: number) {
  g.rect(x, y, w, 16);
  g.fill(PATH_COLOR);
  g.rect(x, y, w, 2);
  g.fill(PATH_EDGE);
  g.rect(x, y + 14, w, 2);
  g.fill(PATH_EDGE);
}

function drawPathV(g: Graphics, x: number, y: number, h: number) {
  g.rect(x, y, 16, h);
  g.fill(PATH_COLOR);
  g.rect(x, y, 2, h);
  g.fill(PATH_EDGE);
  g.rect(x + 14, y, 2, h);
  g.fill(PATH_EDGE);
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

/** Draw a tiled grass ground layer with paths, trees, and decorations */
function createGroundLayer(
  worldW: number, worldH: number,
  rooms: { x: number; y: number; w: number; h: number }[],
): Container {
  const ground = new Container();
  ground.label = "ground-layer";

  // Tile grid pattern with 3-shade grass variation
  const tiles = new Graphics();
  const pad = TILE_SIZE * 4;
  const cols = Math.ceil((worldW + pad * 2) / TILE_SIZE);
  const rows = Math.ceil((worldH + pad * 2) / TILE_SIZE);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tx = col * TILE_SIZE - pad;
      const ty = row * TILE_SIZE - pad;
      const shade = seededRand(col, row);
      const colorIdx = shade < 0.4 ? 0 : shade < 0.75 ? 1 : 2;
      tiles.rect(tx, ty, TILE_SIZE, TILE_SIZE);
      tiles.fill(GRASS_COLORS[colorIdx]);
    }
  }
  ground.addChild(tiles);

  // Dirt paths connecting adjacent department rooms
  const paths = new Graphics();
  const sorted = [...rooms].sort((a, b) => a.y === b.y ? a.x - b.x : a.y - b.y);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      const aRight = a.x + a.w;
      const bLeft = b.x;
      const aMid = a.y + a.h / 2;
      const bMid = b.y + b.h / 2;
      // Horizontal neighbors (same row-ish)
      if (Math.abs(aMid - bMid) < 100 && bLeft > aRight && bLeft - aRight < 120) {
        drawPathH(paths, aRight, Math.min(aMid, bMid), bLeft - aRight);
      }
      // Vertical neighbors (same column-ish)
      const aCx = a.x + a.w / 2;
      const bCx = b.x + b.w / 2;
      const aBot = a.y + a.h;
      const bTop = b.y;
      if (Math.abs(aCx - bCx) < 150 && bTop > aBot && bTop - aBot < 150) {
        drawPathV(paths, Math.min(aCx, bCx), aBot, bTop - aBot);
      }
    }
  }
  ground.addChild(paths);

  // Procedural decorations using seeded random, avoiding room areas
  const decorations = new Graphics();
  const DECOR_STEP = 80;

  for (let dx = -pad; dx < worldW + pad; dx += DECOR_STEP) {
    for (let dy = -pad; dy < worldH + pad; dy += DECOR_STEP) {
      const r = seededRand(dx * 7, dy * 13);
      if (r < 0.15 && !overlapsRoom(dx, dy, 24, rooms, 20)) {
        drawTree(decorations, dx + seededRand(dx, dy * 3) * 20, dy + seededRand(dy, dx * 5) * 20);
      } else if (r < 0.22 && !overlapsRoom(dx, dy, 14, rooms, 16)) {
        drawBush(decorations, dx + seededRand(dx * 2, dy) * 16, dy + seededRand(dy * 2, dx) * 16);
      } else if (r < 0.30 && !overlapsRoom(dx, dy, 6, rooms, 10)) {
        drawFlower(
          decorations,
          dx + seededRand(dx * 3, dy) * 20,
          dy + seededRand(dy * 3, dx) * 20,
          FLOWER_COLORS[Math.floor(seededRand(dx, dy * 7) * FLOWER_COLORS.length)],
        );
      } else if (r < 0.34 && !overlapsRoom(dx, dy, 8, rooms, 12)) {
        drawStone(decorations, dx + seededRand(dx * 5, dy) * 16, dy + seededRand(dy * 5, dx) * 16);
      }
    }
  }

  ground.addChild(decorations);

  return ground;
}

export default function SpatialCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const viewportRef = useRef<Viewport | null>(null);
  const organization = useAppStore((s) => s.organization);

  useEffect(() => {
    const div = containerRef.current;
    if (!div) return;

    let destroyed = false;
    const app = new Application();
    appRef.current = app;

    (async () => {
      await app.init({
        background: "#3D6B33",
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

      // Create viewport
      const viewport = new Viewport({
        screenWidth: div.clientWidth,
        screenHeight: div.clientHeight,
        worldWidth: MIN_WORLD_WIDTH,
        worldHeight: MIN_WORLD_HEIGHT,
        events: app.renderer.events,
      });

      viewport
        .drag()
        .pinch()
        .wheel()
        .decelerate()
        .clampZoom({ minScale: 0.3, maxScale: 3 });

      app.stage.addChild(viewport as unknown as Container);
      viewportRef.current = viewport;
      sharedViewport = viewport;

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

      // Draw ground layer BEFORE rooms and avatars
      const groundLayer = createGroundLayer(worldWidth, worldHeight, rooms);
      viewport.addChild(groundLayer);

      // Load sprite sheet before creating avatars
      await loadSpriteSheet();

      if (destroyed) { app.destroy(true); return; }

      // Render departments and agents
      const avatarContainers: (Container & { _baseY: number; _agentStatus: string })[] = [];

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
          // Ensure agent position falls within its department room
          const px = agent.position.x;
          const py = agent.position.y;
          const inside =
            px >= dx + PAD && px <= dx + dw - PAD &&
            py >= dy + PAD && py <= dy + dh - PAD;

          if (!inside) {
            // Recalculate position within room
            agent.position.x = dx + PAD + (ai % cols) * AGENT_GAP + AGENT_GAP / 2;
            agent.position.y = dy + PAD + 20 + Math.floor(ai / cols) * AGENT_GAP + AGENT_GAP / 2;
          }

          const avatar = createAgentAvatar(agent);
          viewport.addChild(avatar);
          avatarContainers.push(avatar as Container & { _baseY: number; _agentStatus: string });
        }
      }

      // Fit all rooms in view initially
      viewport.fit(true, worldWidth, worldHeight);
      viewport.moveCenter(worldWidth / 2, worldHeight / 2);

      // Animate active agents (gentle floating) and error agents (pulsing)
      let elapsed = 0;
      app.ticker.add((ticker) => {
        const dt = ticker.deltaTime / 60; // seconds
        elapsed += dt;

        for (const avatar of avatarContainers) {
          if (avatar._agentStatus === "active") {
            // Gentle floating bob only — no sprite frame changes
            avatar.y = avatar._baseY + Math.sin(elapsed * 2.5 + avatar._baseY) * 3;
          } else if (avatar._agentStatus === "error") {
            // Pulse the error indicator
            const pulse = 0.85 + Math.sin(elapsed * 5) * 0.15;
            avatar.scale.set(pulse);
          }
        }
      });

      // Handle resize
      const onResize = () => {
        if (destroyed) return;
        app.renderer.resize(div.clientWidth, div.clientHeight);
        viewport.resize(div.clientWidth, div.clientHeight);
      };
      window.addEventListener("resize", onResize);

      // Store cleanup reference
      (app as Application & { _cleanup?: () => void })._cleanup = () => {
        window.removeEventListener("resize", onResize);
      };
    })();

    return () => {
      destroyed = true;
      sharedViewport = null;
      resetSpriteSheet();
      const currentApp = appRef.current;
      if (currentApp) {
        const cleanup = (currentApp as Application & { _cleanup?: () => void })._cleanup;
        if (cleanup) cleanup();
        try {
          // Remove canvas from DOM if it exists
          const canvas = currentApp.canvas as HTMLCanvasElement | undefined;
          if (canvas && canvas.parentNode) {
            canvas.parentNode.removeChild(canvas);
          }
          currentApp.destroy(true, { children: true });
        } catch {
          // Pixi may throw if init hasn't completed yet - safe to ignore
        }
      }
      appRef.current = null;
      viewportRef.current = null;
    };
  }, [organization]);

  const handleZoomIn = useCallback(() => {
    const vp = viewportRef.current;
    if (vp) vp.zoom(-100, true);
  }, []);

  const handleZoomOut = useCallback(() => {
    const vp = viewportRef.current;
    if (vp) vp.zoom(100, true);
  }, []);

  const handleFitAll = useCallback(() => {
    const vp = viewportRef.current;
    if (vp) {
      vp.fit(true, vp.worldWidth, vp.worldHeight);
      vp.moveCenter(vp.worldWidth / 2, vp.worldHeight / 2);
    }
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <MapControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitAll={handleFitAll}
      />
    </div>
  );
}
